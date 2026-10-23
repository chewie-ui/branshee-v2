"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, isNotNull } from "drizzle-orm";
import type Stripe from "stripe";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, referralCredits, users } from "@/db/schema";
import { activeCampaign, addonPrice, billingEnabled, describePromo, findPromo, getOrCreateCustomer, hadSubscriptionBefore, monthlyPriceCents, priceFor, syncSubscription } from "@/server/billing";
import { requireContext, type AppContext } from "@/server/context";
import { stripe } from "@/server/payments";
import { effectivePlan } from "@/server/plan";

type Result = { ok: true; message?: string; url?: string } | { ok: false; error: string };
const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");
const log = (ctx: AppContext, action: string, description: string) => db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action, description });

const planSchema = z.object({ plan: z.enum(["pro", "pro_plus"]), interval: z.enum(["month", "year"]), promo: z.string().max(40).optional() });

async function liveSubscription(ctx: AppContext) {
  const p = await effectivePlan(ctx.business.id);
  if (p.source !== "stripe" && p.source !== "account") return null;
  if (!p.stripeSubscriptionId) return null;
  const sub = await stripe()!.subscriptions.retrieve(p.stripeSubscriptionId).catch(() => null);
  return sub && ["active", "trialing", "past_due"].includes(sub.status) ? sub : null;
}

export async function checkPromo(input: { code: string; plan: string; interval: string }): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  const ctx = await requireContext("billing.manage");
  const v = planSchema.safeParse({ plan: input.plan, interval: input.interval });
  if (!v.success) return { ok: false, error: "Forfait invalide." };
  const promo = await findPromo(input.code, ctx.user.id, v.data.plan, v.data.interval);
  return promo ? { ok: true, label: describePromo(promo) } : { ok: false, error: "Code invalide, expiré ou déjà utilisé." };
}

/**
 * Choisir un forfait : abonnement existant → changement au prorata ; sinon page de paiement Stripe.
 * Code promo (essai, % ou montant), campagne de lancement ou offre par défaut appliqués une seule fois.
 */
export async function choosePlan(input: { plan: string; interval: string; promo?: string }): Promise<Result> {
  const ctx = await requireContext("billing.manage");
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forfait invalide." };
  if (!billingEnabled()) return { ok: false, error: "Le paiement des abonnements n'est pas encore configuré sur ce serveur." };
  const { plan, interval } = parsed.data;
  const price = priceFor(plan, interval)!;
  const s = stripe()!;

  const live = await liveSubscription(ctx);
  if (live) {
    const baseItem = live.items.data.find((i) => i.price.id !== addonPrice.seat() && i.price.id !== addonPrice.customUrl());
    if (!baseItem) return { ok: false, error: "Abonnement introuvable : contactez le support." };
    const updated = await s.subscriptions.update(live.id, { items: [{ id: baseItem.id, price }], proration_behavior: "create_prorations", cancel_at_period_end: false, metadata: { ...live.metadata, businessId: ctx.business.id, userId: ctx.user.id, plan } });
    await syncSubscription(updated);
    await log(ctx, "billing.change", `Forfait changé : ${plan === "pro" ? "Pro" : "Pro+"} (${interval === "year" ? "annuel" : "mensuel"})`);
    revalidatePath("/app", "layout");
    return { ok: true, message: "Forfait mis à jour. La différence est calculée au prorata." };
  }

  const customer = await getOrCreateCustomer({ id: ctx.user.id, email: ctx.user.email, fullName: ctx.user.name });
  const metadata = { businessId: ctx.business.id, userId: ctx.user.id, plan };
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer,
    client_reference_id: ctx.user.id,
    line_items: [{ price, quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    payment_method_collection: "if_required",
    success_url: `${appUrl()}/app/reglages/abonnement/retour?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/app/reglages/abonnement`,
    locale: "fr",
    billing_address_collection: "auto",
    tax_id_collection: { enabled: true },
    customer_update: { name: "auto", address: "auto" },
  };

  const promo = parsed.data.promo ? await findPromo(parsed.data.promo, ctx.user.id, plan, interval) : null;
  if (parsed.data.promo && !promo) return { ok: false, error: "Code promo invalide, expiré ou déjà utilisé." };
  if (promo) {
    if (promo.discountType === "trial") {
      params.subscription_data = { ...params.subscription_data, trial_period_days: promo.trialDays };
      params.payment_method_collection = "always";
    } else {
      // Annuel + pourcentage : la remise vaut un mois, pas une année entière (comme l'ancien).
      const coupon = await s.coupons.create(
        promo.discountType === "percent" && interval === "year"
          ? { duration: "once", amount_off: Math.round((monthlyPriceCents(plan) * promo.discountValue) / 100), currency: "eur" }
          : promo.discountType === "percent"
            ? { duration: "once", percent_off: Math.min(promo.discountValue, 99) }
            : { duration: "once", amount_off: promo.discountValue, currency: "eur" },
      );
      params.discounts = [{ coupon: coupon.id }];
    }
    params.metadata = { ...metadata, promoCodeId: promo.id };
  } else if (!(await hadSubscriptionBefore(ctx.user.id))) {
    // Offre de lancement : première période à prix cassé, une seule fois par compte.
    const campaign = await activeCampaign();
    if (campaign && campaign.plan === plan && interval === "month") {
      const off = monthlyPriceCents(plan) - campaign.firstPeriodCents;
      if (off > 0) {
        const coupon = await s.coupons.create({ duration: "once", amount_off: off, currency: "eur", name: `Offre de lancement — ${(campaign.firstPeriodCents / 100).toFixed(2).replace(".", ",")} € le premier mois` });
        params.discounts = [{ coupon: coupon.id }];
        params.payment_method_collection = "always";
      }
    }
  }
  // Abonnement pris pendant l'essai : les jours restants sont gardés, le premier paiement tombe à la fin de l'essai
  // (Stripe exige une fin d'essai à plus de 48 h).
  const cur = await effectivePlan(ctx.business.id);
  if (cur.isTrial && cur.grantedUntil && cur.grantedUntil.getTime() > Date.now() + 49 * 3600_000 && !params.subscription_data?.trial_period_days) {
    params.subscription_data = { ...params.subscription_data, trial_end: Math.floor(cur.grantedUntil.getTime() / 1000) };
    params.payment_method_collection = "always";
  }
  if (!params.discounts) params.allow_promotion_codes = true;
  const session = await s.checkout.sessions.create(params);
  return { ok: true, url: session.url! };
}

export async function cancelPlan(): Promise<Result> {
  const ctx = await requireContext("billing.manage");
  const live = await liveSubscription(ctx);
  if (!live) return { ok: false, error: "Aucun abonnement payant à résilier." };
  const updated = await stripe()!.subscriptions.update(live.id, { cancel_at_period_end: true });
  await syncSubscription(updated);
  await log(ctx, "billing.cancel", "Abonnement résilié (fin à l'échéance)");
  revalidatePath("/app/reglages/abonnement");
  return { ok: true, message: "Résiliation enregistrée : vous gardez votre forfait jusqu'à l'échéance." };
}

export async function resumePlan(): Promise<Result> {
  const ctx = await requireContext("billing.manage");
  const live = await liveSubscription(ctx);
  if (!live) return { ok: false, error: "Aucun abonnement à reprendre." };
  const updated = await stripe()!.subscriptions.update(live.id, { cancel_at_period_end: false });
  await syncSubscription(updated);
  await log(ctx, "billing.resume", "Abonnement repris");
  revalidatePath("/app/reglages/abonnement");
  return { ok: true, message: "Abonnement repris." };
}

/** Cartes, factures PDF, adresse de facturation : portail sécurisé de Stripe. */
export async function openBillingPortal(): Promise<Result> {
  const ctx = await requireContext("billing.manage");
  if (!stripe()) return { ok: false, error: "Facturation non configurée." };
  const customer = await getOrCreateCustomer({ id: ctx.user.id, email: ctx.user.email, fullName: ctx.user.name });
  const portal = await stripe()!.billingPortal.sessions.create({ customer, return_url: `${appUrl()}/app/reglages/abonnement`, locale: "fr" });
  return { ok: true, url: portal.url };
}

/** Options : URL personnalisée (Pro) et sièges collaborateurs (Pro et Pro+), ajoutées à l'abonnement en cours. */
export async function setCustomUrlAddon(on: boolean): Promise<Result> {
  const ctx = await requireContext("billing.manage");
  const live = await liveSubscription(ctx);
  const price = addonPrice.customUrl();
  if (!live || !price) return { ok: false, error: "Option disponible avec un abonnement Pro actif." };
  const item = live.items.data.find((i) => i.price.id === price);
  const s = stripe()!;
  if (on && !item) await s.subscriptionItems.create({ subscription: live.id, price, quantity: 1, proration_behavior: "create_prorations" });
  if (!on && item) await s.subscriptionItems.del(item.id, { proration_behavior: "create_prorations" });
  await syncSubscription(await s.subscriptions.retrieve(live.id));
  await log(ctx, "billing.addon", on ? "Option URL personnalisée ajoutée" : "Option URL personnalisée retirée");
  revalidatePath("/app", "layout");
  return { ok: true, message: on ? "Option ajoutée." : "Option retirée." };
}

export async function setExtraSeats(n: number): Promise<Result> {
  const ctx = await requireContext("billing.manage");
  const seats = z.number().int().min(0).max(50).safeParse(n);
  if (!seats.success) return { ok: false, error: "Nombre de sièges invalide." };
  const live = await liveSubscription(ctx);
  const price = addonPrice.seat();
  if (!live || !price) return { ok: false, error: "Sièges disponibles avec un abonnement Pro ou Pro+ actif." };
  const item = live.items.data.find((i) => i.price.id === price);
  const s = stripe()!;
  if (seats.data === 0 && item) await s.subscriptionItems.del(item.id, { proration_behavior: "create_prorations" });
  else if (seats.data > 0 && item) await s.subscriptionItems.update(item.id, { quantity: seats.data, proration_behavior: "create_prorations" });
  else if (seats.data > 0) await s.subscriptionItems.create({ subscription: live.id, price, quantity: seats.data, proration_behavior: "create_prorations" });
  await syncSubscription(await s.subscriptions.retrieve(live.id));
  await log(ctx, "billing.seats", `Sièges collaborateurs : ${seats.data}`);
  revalidatePath("/app", "layout");
  return { ok: true, message: `${seats.data} siège${seats.data > 1 ? "s" : ""} supplémentaire${seats.data > 1 ? "s" : ""}.` };
}

/* ───────── Parrainage : 3 filleuls payants = 2 mois offerts ───────── */

export async function referralStatus(userId: string) {
  const [[{ paying }], [credit]] = await Promise.all([
    db.select({ paying: count() }).from(users).where(and(eq(users.referredById, userId), isNotNull(users.referralPaidAt))),
    db.select().from(referralCredits).where(eq(referralCredits.userId, userId)),
  ]);
  const earned = Math.floor(paying / 3) * 2;
  return { paying, claimed: credit?.monthsClaimed ?? 0, claimable: Math.max(0, earned - (credit?.monthsClaimed ?? 0)) };
}

export async function claimReferral(): Promise<Result> {
  const ctx = await requireContext("billing.manage");
  const st = await referralStatus(ctx.user.id);
  if (st.claimable <= 0) return { ok: false, error: "Aucun mois à réclamer pour le moment." };
  const live = await liveSubscription(ctx);
  if (!live) return { ok: false, error: "Il faut un abonnement payant actif pour utiliser vos mois offerts." };
  const s = stripe()!;
  const coupon = await s.coupons.create({ percent_off: 100, duration: st.claimable > 1 ? "repeating" : "once", duration_in_months: st.claimable > 1 ? st.claimable : undefined, name: `Parrainage — ${st.claimable} mois offert${st.claimable > 1 ? "s" : ""}` });
  await s.subscriptions.update(live.id, { discounts: [{ coupon: coupon.id }] });
  await db.insert(referralCredits).values({ userId: ctx.user.id, monthsClaimed: st.claimed + st.claimable }).onConflictDoUpdate({ target: referralCredits.userId, set: { monthsClaimed: st.claimed + st.claimable } });
  await log(ctx, "billing.referral", `${st.claimable} mois offerts par parrainage`);
  revalidatePath("/app/reglages/abonnement");
  return { ok: true, message: `${st.claimable} mois offert${st.claimable > 1 ? "s" : ""} appliqué${st.claimable > 1 ? "s" : ""} sur vos prochaines factures.` };
}



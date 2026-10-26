import "server-only";
import type Stripe from "stripe";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { businessPlans, formQuestions, members, notificationSettings, promoCampaigns, promoCodes, promoRedemptions, services, subscriptions, users } from "@/db/schema";
import { LIMITS, PLANS, collaboratorLimit, type Plan } from "@/lib/plans";
import { stripe } from "@/server/payments";
import { invoiceFooter } from "@/lib/legal";

/**
 * Abonnements Branshee (le pro paie Branshee), portés par l'établissement.
 * Un abonnement Stripe = le forfait + options (URL personnalisée, sièges) en lignes du même abonnement.
 */
type Interval = "month" | "year";
const env = (k: string) => process.env[k] || null;

export function priceFor(plan: Exclude<Plan, "free">, interval: Interval) {
  const key = `STRIPE_PRICE_${plan === "pro" ? "PRO" : "PROPLUS"}_${interval === "year" ? "YEARLY" : "MONTHLY"}`;
  // Pas de prix annuel configuré : on facture le mensuel plutôt que de bloquer (comme l'ancien).
  return env(key) ?? env(`STRIPE_PRICE_${plan === "pro" ? "PRO" : "PROPLUS"}_MONTHLY`);
}
export const addonPrice = { customUrl: () => env("STRIPE_PRICE_CUSTOM_URL"), seat: () => env("STRIPE_PRICE_EXTRA_SEAT") };

export function planFromPrice(priceId: string | undefined | null): { plan: Exclude<Plan, "free">; interval: Interval } | null {
  if (!priceId) return null;
  for (const plan of ["pro", "pro_plus"] as const)
    for (const interval of ["month", "year"] as const) if (env(`STRIPE_PRICE_${plan === "pro" ? "PRO" : "PROPLUS"}_${interval === "year" ? "YEARLY" : "MONTHLY"}`) === priceId) return { plan, interval };
  return null;
}

export const billingEnabled = () => !!stripe() && !!priceFor("pro", "month");

export async function getOrCreateCustomer(user: { id: string; email: string; fullName: string }) {
  const s = stripe()!;
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id));
  if (row?.stripeCustomerId) {
    const c = await s.customers.retrieve(row.stripeCustomerId).catch(() => null);
    if (c && !("deleted" in c && c.deleted)) {
      if (c.invoice_settings?.footer !== invoiceFooter) await s.customers.update(row.stripeCustomerId, { invoice_settings: { footer: invoiceFooter } }).catch(() => {});
      return row.stripeCustomerId;
    }
  }
  // Pied de facture légal (identité, adresse, BCE, TVA) sur toutes les factures de ce client.
  const c = await s.customers.create({ email: user.email, name: user.fullName, metadata: { userId: user.id }, invoice_settings: { footer: invoiceFooter } });
  await db.insert(subscriptions).values({ userId: user.id, stripeCustomerId: c.id }).onConflictDoUpdate({ target: subscriptions.userId, set: { stripeCustomerId: c.id } });
  return c.id;
}

const STATUS: Record<string, "active" | "trialing" | "past_due" | "cancelled" | "expired"> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  unpaid: "past_due",
  canceled: "cancelled",
  incomplete: "expired",
  incomplete_expired: "expired",
  paused: "expired",
};

/** Recopie l'état d'un abonnement Stripe sur l'établissement (appelé au retour du paiement et par le webhook). */
export async function syncSubscription(sub: Stripe.Subscription) {
  let businessId = sub.metadata?.businessId || null;
  if (!businessId) {
    const [row] = await db.select({ id: businessPlans.businessId }).from(businessPlans).where(eq(businessPlans.stripeSubscriptionId, sub.id));
    businessId = row?.id ?? null;
  }
  if (!businessId) return null;
  let base: { plan: Exclude<Plan, "free">; interval: Interval } | null = null;
  let seats = 0;
  let customUrl = false;
  let periodEnd: number | null = null;
  for (const item of sub.items.data) {
    const id = item.price.id;
    const found = planFromPrice(id);
    if (found) base = found;
    if (id === addonPrice.seat()) seats = item.quantity ?? 0;
    if (id === addonPrice.customUrl()) customUrl = true;
    const end = (item as unknown as { current_period_end?: number }).current_period_end;
    if (end) periodEnd = Math.max(periodEnd ?? 0, end);
  }
  periodEnd ??= (sub as unknown as { current_period_end?: number }).current_period_end ?? null;
  const status = STATUS[sub.status] ?? "expired";
  const ended = status === "cancelled" || status === "expired";
  const values = {
    plan: (ended ? "free" : (base?.plan ?? "pro")) as Plan,
    interval: base?.interval ?? null,
    status,
    stripeSubscriptionId: ended ? null : sub.id,
    periodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    extraSeats: ended ? 0 : seats,
    customUrlAddon: ended ? false : customUrl,
    // L'essai gratuit s'arrête dès qu'un abonnement existe (ses jours restants sont repris par Stripe).
    isTrial: false,
    ...(ended ? { grantedUntil: null } : {}),
  };
  const [before] = await db.select({ plan: businessPlans.plan }).from(businessPlans).where(eq(businessPlans.businessId, businessId));
  await db.insert(businessPlans).values({ businessId, ...values }).onConflictDoUpdate({ target: businessPlans.businessId, set: values });
  if (!ended) await countReferral(sub.metadata?.userId);
  // Passage du gratuit au payant : les rappels SMS (quota inclus dans le forfait) s'allument d'office.
  // Le pro peut toujours les couper dans Réglages › SMS et WhatsApp.
  if (!ended && rank(values.plan) > 0 && (!before || rank(before.plan) === 0)) {
    await db.insert(notificationSettings).values({ businessId, smsReminders: true }).onConflictDoUpdate({ target: notificationSettings.businessId, set: { smsReminders: true } });
  }
  // Forfait inférieur : on désactive ce qui dépasse (jamais de suppression).
  if (before && rank(values.plan) < rank(before.plan)) await enforceLimits(businessId, values.plan, values.extraSeats);
  return { businessId, ...values };
}

const rank = (p: Plan) => ({ free: 0, pro: 1, pro_plus: 2 })[p];

/** Premier paiement d'un filleul : il compte pour son parrain, une seule fois. */
async function countReferral(userId: string | undefined) {
  if (!userId) return;
  await db.update(users).set({ referralPaidAt: new Date() }).where(and(eq(users.id, userId), isNull(users.referralPaidAt), sql`${users.referredById} is not null`));
}

/**
 * Passage à un forfait inférieur : prestations au-delà de la limite masquées, collaborateurs en trop
 * rendus non réservables, questions du formulaire en trop retirées (comme l'ancien Branshee).
 */
export async function enforceLimits(businessId: string, plan: Plan, extraSeats: number) {
  const maxServices = LIMITS.services[plan];
  if (Number.isFinite(maxServices)) {
    const active = await db.select({ id: services.id }).from(services).where(and(eq(services.businessId, businessId), eq(services.isActive, true))).orderBy(asc(services.position), asc(services.createdAt));
    const extra = active.slice(maxServices).map((s) => s.id);
    if (extra.length) await db.update(services).set({ isActive: false }).where(inArray(services.id, extra));
  }
  const maxCollab = collaboratorLimit(plan, extraSeats);
  const collab = await db.select({ id: members.id }).from(members).where(and(eq(members.businessId, businessId), eq(members.isOwner, false), eq(members.isBookable, true))).orderBy(asc(members.joinedAt), asc(members.createdAt));
  const tooMany = collab.slice(maxCollab).map((m) => m.id);
  if (tooMany.length) await db.update(members).set({ isBookable: false }).where(inArray(members.id, tooMany));
  const maxQ = LIMITS.formQuestions[plan];
  const qs = await db.select({ id: formQuestions.id }).from(formQuestions).where(eq(formQuestions.businessId, businessId)).orderBy(asc(formQuestions.position));
  const dropQ = qs.slice(maxQ).map((q) => q.id);
  if (dropQ.length) await db.delete(formQuestions).where(inArray(formQuestions.id, dropQ));
}

/** Code promo valable pour ce compte et ce forfait ? */
export async function findPromo(code: string, userId: string, plan: Exclude<Plan, "free">, interval: Interval) {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const [p] = await db.select().from(promoCodes).where(and(sql`upper(${promoCodes.code}) = ${clean}`, eq(promoCodes.isActive, true)));
  if (!p) return null;
  if (p.expiresAt && p.expiresAt < new Date()) return null;
  if (p.maxUses != null && p.usedCount >= p.maxUses) return null;
  if (p.appliesTo && p.appliesTo !== `${plan}:${interval}` && p.appliesTo !== plan) return null;
  const [used] = await db.select().from(promoRedemptions).where(and(eq(promoRedemptions.promoCodeId, p.id), eq(promoRedemptions.userId, userId)));
  return used ? null : p;
}

export function describePromo(p: typeof promoCodes.$inferSelect) {
  if (p.discountType === "trial") return `${p.trialDays} jours d'essai gratuit`;
  if (p.discountType === "percent") return `-${p.discountValue} % sur la première période`;
  return `-${(p.discountValue / 100).toFixed(2).replace(".", ",")} € sur la première facture`;
}

/** Campagne en cours (compte à rebours) : première période à prix cassé, une seule fois par compte. */
export async function activeCampaign() {
  const [c] = await db.select().from(promoCampaigns).where(and(eq(promoCampaigns.isActive, true), sql`(${promoCampaigns.endsAt} is null or ${promoCampaigns.endsAt} > now())`)).limit(1);
  return c ?? null;
}

export async function hadSubscriptionBefore(userId: string) {
  const [row] = await db.select({ id: subscriptions.stripeSubscriptionId }).from(subscriptions).where(eq(subscriptions.userId, userId));
  const [biz] = await db.execute<{ n: number }>(sql`select count(*)::int as n from business_plans bp join businesses b on b.id = bp.business_id where b.owner_id = ${userId} and bp.interval is not null`);
  return !!row?.id || Number(biz?.n ?? 0) > 0;
}

export const monthlyPriceCents = (plan: Exclude<Plan, "free">) => Math.round(PLANS[plan].monthly * 100);

/** Paiement d'abonnement confirmé (retour de Stripe ou webhook) : forfait activé, code promo consommé. */
export async function completeCheckout(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription" || !["paid", "no_payment_required"].includes(session.payment_status) || !session.subscription) return null;
  const s = stripe()!;
  const sub = typeof session.subscription === "string" ? await s.subscriptions.retrieve(session.subscription) : session.subscription;
  if (!sub.metadata?.businessId && session.metadata?.businessId) await s.subscriptions.update(sub.id, { metadata: { ...sub.metadata, businessId: session.metadata.businessId, userId: session.metadata.userId ?? "" } });
  const synced = await syncSubscription({ ...sub, metadata: { ...sub.metadata, ...(session.metadata ?? {}) } } as Stripe.Subscription);
  const promoId = session.metadata?.promoCodeId;
  const userId = session.metadata?.userId;
  if (promoId && userId) {
    const inserted = await db.insert(promoRedemptions).values({ promoCodeId: promoId, userId }).onConflictDoNothing().returning({ id: promoRedemptions.promoCodeId });
    if (inserted.length) await db.update(promoCodes).set({ usedCount: sql`${promoCodes.usedCount} + 1` }).where(eq(promoCodes.id, promoId));
  }
  return synced;
}


let vatRateId: string | null = null;
/** Taux de TVA Stripe (21 %, Belgique, compris dans le prix) appliqué aux factures Branshee ; créé une fois, puis réutilisé. */
export async function vatRate(): Promise<string> {
  if (vatRateId) return vatRateId;
  const s = stripe()!;
  for await (const r of s.taxRates.list({ active: true, limit: 100 })) {
    if (r.metadata?.branshee === "vat21-incl") return (vatRateId = r.id);
  }
  const r = await s.taxRates.create({ display_name: "TVA", description: "TVA belge 21 %", percentage: 21, inclusive: true, country: "BE", jurisdiction: "BE", tax_type: "vat", metadata: { branshee: "vat21-incl" } });
  return (vatRateId = r.id);
}

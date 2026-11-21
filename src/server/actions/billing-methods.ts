"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { businessSubscription, billingCustomer, defaultMethodId } from "@/server/billing-methods";
import { requireContext, type AppContext } from "@/server/context";
import { stripe } from "@/server/payments";

type Result = { ok: true; message?: string; clientSecret?: string } | { ok: false; error: string };
const PATH = "/app/reglages/factures";
const log = (ctx: AppContext, action: string, description: string) => db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action, description });

async function guard() {
  const ctx = await requireContext("billing.manage", { allowLocked: true });
  if (ctx.impersonating) return { error: "Action réservée au titulaire du compte (session de supervision)." } as const;
  if (!stripe()) return { error: "Paiement non configuré." } as const;
  return { ctx } as const;
}

/** Le moyen de paiement appartient-il bien au client Stripe de cet établissement ? */
async function ownMethod(customer: string, pmId: string) {
  if (typeof pmId !== "string" || !/^pm_[A-Za-z0-9]{6,60}$/.test(pmId)) return null;
  const pm = await stripe()!.paymentMethods.retrieve(pmId).catch(() => null);
  const owner = pm ? (typeof pm.customer === "string" ? pm.customer : pm.customer?.id) : null;
  return pm && owner === customer ? pm : null;
}

async function makeDefault(ctx: AppContext, customer: string, pmId: string) {
  await stripe()!.customers.update(customer, { invoice_settings: { default_payment_method: pmId } });
  const sub = await businessSubscription(ctx.business.id);
  if (sub) await stripe()!.subscriptions.update(sub.id, { default_payment_method: pmId });
}

/** Début de l'ajout : la carte est saisie chez Stripe (formulaire sécurisé), jamais chez nous. */
export async function startAddPaymentMethod(): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error! };
  const customer = await billingCustomer(g.ctx, { create: true });
  if (!customer) return { ok: false, error: "Paiement non configuré." };
  const si = await stripe()!.setupIntents.create({ customer, usage: "off_session", automatic_payment_methods: { enabled: true, allow_redirects: "never" }, metadata: { businessId: g.ctx.business.id, userId: g.ctx.user.id } });
  return { ok: true, clientSecret: si.client_secret! };
}

/** Fin de l'ajout : le premier moyen de paiement devient celui par défaut. */
export async function finishAddPaymentMethod(setupIntentId: string): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error! };
  const customer = await billingCustomer(g.ctx);
  if (!customer || typeof setupIntentId !== "string" || !/^seti_[A-Za-z0-9]{6,80}$/.test(setupIntentId)) return { ok: false, error: "Ajout introuvable." };
  const si = await stripe()!.setupIntents.retrieve(setupIntentId).catch(() => null);
  const siCustomer = si ? (typeof si.customer === "string" ? si.customer : si.customer?.id) : null;
  if (!si || siCustomer !== customer || si.status !== "succeeded" || !si.payment_method) return { ok: false, error: "Le moyen de paiement n'a pas été validé." };
  const pmId = typeof si.payment_method === "string" ? si.payment_method : si.payment_method.id;
  const sub = await businessSubscription(g.ctx.business.id);
  if (!(await defaultMethodId(customer, sub))) await makeDefault(g.ctx, customer, pmId);
  await log(g.ctx, "billing.method_add", "Moyen de paiement ajouté");
  revalidatePath(PATH);
  return { ok: true, message: "Moyen de paiement ajouté." };
}

export async function setDefaultPaymentMethod(pmId: string): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error! };
  const customer = await billingCustomer(g.ctx);
  if (!customer || !(await ownMethod(customer, pmId))) return { ok: false, error: "Moyen de paiement introuvable." };
  await makeDefault(g.ctx, customer, pmId);
  await log(g.ctx, "billing.method_default", "Moyen de paiement par défaut changé");
  revalidatePath(PATH);
  return { ok: true, message: "C'est maintenant votre moyen de paiement par défaut." };
}

export async function removePaymentMethod(pmId: string): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error! };
  const customer = await billingCustomer(g.ctx);
  if (!customer || !(await ownMethod(customer, pmId))) return { ok: false, error: "Moyen de paiement introuvable." };
  const s = stripe()!;
  const [all, sub] = await Promise.all([s.customers.listPaymentMethods(customer, { limit: 20 }).then((r) => r.data), businessSubscription(g.ctx.business.id)]);
  const others = all.filter((p) => p.id !== pmId);
  const autoCharge = !!sub && sub.collection_method === "charge_automatically" && !sub.cancel_at_period_end;
  if (others.length === 0 && autoCharge) return { ok: false, error: "C'est le seul moyen de paiement de votre abonnement : ajoutez-en d'abord un autre, puis retirez celui-ci." };
  if ((await defaultMethodId(customer, sub)) === pmId && others[0]) await makeDefault(g.ctx, customer, others[0].id);
  await s.paymentMethods.detach(pmId);
  await log(g.ctx, "billing.method_remove", "Moyen de paiement retiré");
  revalidatePath(PATH);
  return { ok: true, message: "Moyen de paiement retiré." };
}

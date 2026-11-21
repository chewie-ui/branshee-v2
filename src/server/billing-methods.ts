import "server-only";
import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, subscriptions } from "@/db/schema";
import { getOrCreateCustomer } from "@/server/billing";
import type { AppContext } from "@/server/context";
import { stripe } from "@/server/payments";
import { effectivePlan } from "@/server/plan";

export type PaymentMethodView = { id: string; kind: "card" | "sepa" | "other"; label: string; detail: string; isDefault: boolean; expired: boolean };

/** Abonnement Stripe en cours de l'établissement (celui qui est prélevé). */
export async function businessSubscription(businessId: string): Promise<Stripe.Subscription | null> {
  const s = stripe();
  const p = await effectivePlan(businessId).catch(() => null);
  if (!s || !p?.stripeSubscriptionId) return null;
  const sub = await s.subscriptions.retrieve(p.stripeSubscriptionId).catch(() => null);
  return sub && ["active", "trialing", "past_due", "incomplete"].includes(sub.status) ? sub : null;
}

/**
 * Client Stripe qui paie l'abonnement de l'établissement : celui de l'abonnement en cours,
 * sinon celui du titulaire, sinon (création) celui de l'utilisateur connecté.
 */
export async function billingCustomer(ctx: AppContext, opts: { create?: boolean } = {}): Promise<string | null> {
  const sub = await businessSubscription(ctx.business.id);
  if (sub) return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const [owner] = await db
    .select({ customer: subscriptions.stripeCustomerId })
    .from(members)
    .innerJoin(subscriptions, eq(subscriptions.userId, members.userId))
    .where(and(eq(members.businessId, ctx.business.id), eq(members.isOwner, true)))
    .limit(1);
  if (owner?.customer) return owner.customer;
  if (!opts.create || !stripe()) return null;
  return getOrCreateCustomer({ id: ctx.user.id, email: ctx.user.email, fullName: ctx.user.name });
}

/** Moyen de paiement par défaut : celui de l'abonnement, sinon celui du client Stripe. */
export async function defaultMethodId(customer: string, sub: Stripe.Subscription | null): Promise<string | null> {
  const id = (x: string | { id: string } | null | undefined) => (x ? (typeof x === "string" ? x : x.id) : null);
  const fromSub = id(sub?.default_payment_method as string | { id: string } | null);
  if (fromSub) return fromSub;
  const c = await stripe()!.customers.retrieve(customer).catch(() => null);
  return c && !c.deleted ? id(c.invoice_settings?.default_payment_method as string | { id: string } | null) : null;
}

const BRANDS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", bancontact: "Bancontact", maestro: "Maestro", cartes_bancaires: "Carte bancaire", discover: "Discover" };

export async function listPaymentMethods(ctx: AppContext): Promise<{ methods: PaymentMethodView[]; customer: string | null }> {
  const s = stripe();
  if (!s) return { methods: [], customer: null };
  const customer = await billingCustomer(ctx);
  if (!customer) return { methods: [], customer: null };
  const [list, sub] = await Promise.all([s.customers.listPaymentMethods(customer, { limit: 20 }).then((r) => r.data).catch(() => []), businessSubscription(ctx.business.id)]);
  const def = await defaultMethodId(customer, sub);
  const now = new Date();
  return {
    customer,
    methods: list.map((pm) => {
      if (pm.card) {
        const expired = pm.card.exp_year < now.getFullYear() || (pm.card.exp_year === now.getFullYear() && pm.card.exp_month < now.getMonth() + 1);
        return { id: pm.id, kind: "card" as const, label: `${BRANDS[pm.card.brand] ?? pm.card.brand} •••• ${pm.card.last4}`, detail: `Expire ${String(pm.card.exp_month).padStart(2, "0")}/${String(pm.card.exp_year).slice(-2)}`, isDefault: pm.id === def, expired };
      }
      if (pm.sepa_debit) return { id: pm.id, kind: "sepa" as const, label: `Domiciliation •••• ${pm.sepa_debit.last4}`, detail: pm.sepa_debit.country ? `Compte ${pm.sepa_debit.country}` : "Compte bancaire", isDefault: pm.id === def, expired: false };
      return { id: pm.id, kind: "other" as const, label: pm.type, detail: "", isDefault: pm.id === def, expired: false };
    }),
  };
}

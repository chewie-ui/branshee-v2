import "server-only";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessPlans } from "@/db/schema";
import { stripe } from "@/server/payments";

export type AdminSubInfo = {
  subscription: { id: string; status: string; cancelAtPeriodEnd: boolean; periodEnd: string | null; collection: "card" | "invoice" } | null;
  /** Dernière facture payée de l'abonnement et ce qu'on peut encore rembourser dessus. */
  lastPaid: { id: string; number: string | null; date: string; paidCents: number; refundableCents: number; outOfBand: boolean } | null;
};

const subInvoiceId = (i: Stripe.Invoice) => {
  const x = i as unknown as { subscription?: string | { id: string } | null; parent?: { subscription_details?: { subscription?: string | { id: string } } } };
  const v = x.subscription ?? x.parent?.subscription_details?.subscription ?? null;
  return v ? (typeof v === "string" ? v : v.id) : null;
};

/** Abonnement Stripe de l'établissement, vu par le super-admin (pour l'annuler, avec ou sans remboursement). */
export async function adminSubInfo(businessId: string): Promise<AdminSubInfo> {
  const s = stripe();
  const [bp] = await db.select({ subId: businessPlans.stripeSubscriptionId }).from(businessPlans).where(eq(businessPlans.businessId, businessId));
  if (!s || !bp?.subId) return { subscription: null, lastPaid: null };
  const sub = await s.subscriptions.retrieve(bp.subId).catch(() => null);
  if (!sub) return { subscription: null, lastPaid: null };
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const invoices = await s.invoices.list({ customer, status: "paid", limit: 20 }).then((r) => r.data).catch(() => []);
  const last = invoices.find((i) => subInvoiceId(i) === sub.id && i.amount_paid > 0) ?? null;
  // Payée par carte (paiement Stripe) ou hors carte (virement marqué payé) : décide du type de remboursement.
  const payments = last ? await s.invoicePayments.list({ invoice: last.id!, limit: 5 }).then((r) => r.data).catch(() => []) : [];
  const outOfBand = !payments.some((p) => p.status === "paid" && (p.payment?.payment_intent || p.payment?.charge));
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end ?? sub.items.data[0]?.current_period_end ?? null;
  return {
    subscription: { id: sub.id, status: sub.status, cancelAtPeriodEnd: sub.cancel_at_period_end, periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null, collection: sub.collection_method === "send_invoice" ? "invoice" : "card" },
    lastPaid: last
      ? { id: last.id!, number: last.number ?? null, date: new Date((last.status_transitions?.paid_at ?? last.created) * 1000).toISOString(), paidCents: last.amount_paid, refundableCents: Math.max(0, last.amount_paid - (last.post_payment_credit_notes_amount ?? 0)), outOfBand }
      : null,
  };
}

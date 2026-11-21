import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, subscriptions } from "@/db/schema";
import { stripe } from "@/server/payments";
import { effectivePlan } from "@/server/plan";

export type BillingInvoice = { id: string; kind: "invoice" | "credit_note"; number: string | null; date: string; totalCents: number; creditedCents: number; currency: string; status: "paid" | "open" | "void" | "uncollectible" | "credit"; pdf: string | null; payUrl: string | null; ofInvoice: string | null };

/**
 * Factures de l'abonnement de l'établissement (Skydev ou Branshee), lues chez Stripe :
 * client Stripe de l'abonnement en cours, et celui du titulaire (factures envoyées par email, anciens abonnements).
 */
export async function businessInvoices(businessId: string): Promise<BillingInvoice[]> {
  const s = stripe();
  if (!s) return [];
  const customers = new Set<string>();
  const plan = await effectivePlan(businessId).catch(() => null);
  if (plan?.stripeSubscriptionId) {
    const sub = await s.subscriptions.retrieve(plan.stripeSubscriptionId).catch(() => null);
    if (sub) customers.add(typeof sub.customer === "string" ? sub.customer : sub.customer.id);
  }
  const owners = await db
    .select({ customer: subscriptions.stripeCustomerId })
    .from(members)
    .innerJoin(subscriptions, eq(subscriptions.userId, members.userId))
    .where(and(eq(members.businessId, businessId), eq(members.isOwner, true)));
  for (const o of owners) if (o.customer) customers.add(o.customer);
  const lists = await Promise.all([...customers].map((customer) => s.invoices.list({ customer, limit: 36 }).then((r) => r.data).catch(() => [])));
  const credits = await Promise.all([...customers].map((customer) => s.creditNotes.list({ customer, limit: 36, expand: ["data.invoice"] }).then((r) => r.data).catch(() => [])));
  const seen = new Set<string>();
  const invoices: BillingInvoice[] = lists
    .flat()
    .filter((i) => i.id && i.status && i.status !== "draft" && !seen.has(i.id) && seen.add(i.id))
    .map((i) => ({
      id: i.id!,
      kind: "invoice" as const,
      number: i.number ?? null,
      date: new Date((i.status_transitions?.finalized_at ?? i.created) * 1000).toISOString(),
      totalCents: i.total,
      creditedCents: i.post_payment_credit_notes_amount ?? 0,
      currency: i.currency,
      status: i.status as BillingInvoice["status"],
      pdf: i.invoice_pdf ?? null,
      payUrl: i.status === "open" ? (i.hosted_invoice_url ?? null) : null,
      ofInvoice: null,
    }));
  // Notes de crédit (remboursement ou annulation d'une facture payée) : listées avec les factures.
  const notes: BillingInvoice[] = credits
    .flat()
    .filter((c) => c.status !== "void" && !seen.has(c.id) && seen.add(c.id))
    .map((c) => ({
      id: c.id,
      kind: "credit_note" as const,
      number: c.number,
      date: new Date((c.effective_at ?? c.created) * 1000).toISOString(),
      totalCents: -c.total,
      creditedCents: 0,
      currency: c.currency,
      status: "credit" as const,
      pdf: c.pdf ?? null,
      payUrl: null,
      ofInvoice: typeof c.invoice === "string" ? null : (c.invoice?.number ?? null),
    }));
  return [...invoices, ...notes].sort((a, b) => b.date.localeCompare(a.date));
}

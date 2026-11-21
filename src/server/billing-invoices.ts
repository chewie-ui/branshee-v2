import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, subscriptions } from "@/db/schema";
import { stripe } from "@/server/payments";
import { effectivePlan } from "@/server/plan";

export type BillingInvoice = { id: string; number: string | null; date: string; totalCents: number; currency: string; status: "paid" | "open" | "void" | "uncollectible"; pdf: string | null; payUrl: string | null };

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
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((i) => i.id && i.status && i.status !== "draft" && !seen.has(i.id) && seen.add(i.id))
    .sort((a, b) => b.created - a.created)
    .map((i) => ({
      id: i.id!,
      number: i.number ?? null,
      date: new Date((i.status_transitions?.finalized_at ?? i.created) * 1000).toISOString(),
      totalCents: i.total,
      currency: i.currency,
      status: i.status as BillingInvoice["status"],
      pdf: i.invoice_pdf ?? null,
      payUrl: i.status === "open" ? (i.hosted_invoice_url ?? null) : null,
    }));
}

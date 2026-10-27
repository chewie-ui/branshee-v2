import "server-only";
import type Stripe from "stripe";
import { and, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, businessPlans, subscriptions, users } from "@/db/schema";
import { stripe } from "@/server/payments";

/**
 * Toutes les factures et notes de crédit Stripe de Branshee, pour le super-admin (et l'export comptable).
 * Chaque document est relié au compte et à l'établissement du client quand on les retrouve.
 */
export type AdminDoc = {
  id: string;
  kind: "invoice" | "credit";
  number: string | null;
  status: string;
  date: Date;
  paidAt: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  description: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  customerVat: string;
  htCents: number;
  vatCents: number;
  ttcCents: number;
  refInvoice: string | null;
  pdf: string | null;
  hosted: string | null;
  userId: string | null;
  businessId: string | null;
  businessName: string | null;
};

export const STATUS_LABEL: Record<string, string> = {
  paid: "Payée",
  open: "À payer",
  void: "Annulée",
  draft: "Brouillon",
  uncollectible: "Irrécouvrable",
  issued: "Émise",
};

const MAX = 2000;

const addr = (a: Stripe.Address | null | undefined) =>
  a ? [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.country].filter(Boolean).join(", ") : "";

const ts = (n: number | null | undefined) => (n ? new Date(n * 1000) : null);

function subscriptionOf(inv: Stripe.Invoice): string | null {
  const s = inv.parent?.subscription_details?.subscription;
  return typeof s === "string" ? s : (s?.id ?? null);
}

export async function listAdminDocuments(): Promise<{ docs: AdminDoc[]; configured: boolean; truncated: boolean }> {
  const s = stripe();
  if (!s) return { docs: [], configured: false, truncated: false };

  const invoices: Stripe.Invoice[] = [];
  for await (const inv of s.invoices.list({ limit: 100 })) {
    invoices.push(inv);
    if (invoices.length >= MAX) break;
  }
  const credits: Stripe.CreditNote[] = [];
  for await (const cn of s.creditNotes.list({ limit: 100, expand: ["data.invoice"] })) {
    credits.push(cn);
    if (credits.length >= MAX) break;
  }

  // Client Stripe → compte Branshee ; abonnement Stripe → établissement.
  const customerIds = [...new Set(invoices.map((i) => (typeof i.customer === "string" ? i.customer : i.customer?.id)).filter((x): x is string => !!x))];
  const subIds = [...new Set(invoices.map(subscriptionOf).filter((x): x is string => !!x))];
  const [accounts, plans] = await Promise.all([
    customerIds.length
      ? db.select({ userId: subscriptions.userId, customer: subscriptions.stripeCustomerId }).from(subscriptions).where(inArray(subscriptions.stripeCustomerId, customerIds))
      : Promise.resolve([]),
    subIds.length
      ? db.select({ businessId: businessPlans.businessId, sub: businessPlans.stripeSubscriptionId }).from(businessPlans).where(inArray(businessPlans.stripeSubscriptionId, subIds))
      : Promise.resolve([]),
  ]);
  const userByCustomer = new Map(accounts.map((a) => [a.customer!, a.userId]));
  const businessBySub = new Map(plans.map((p) => [p.sub!, p.businessId]));
  const userIds = [...new Set(accounts.map((a) => a.userId))];
  const owned = userIds.length
    ? await db.select({ id: businesses.id, ownerId: businesses.ownerId }).from(businesses).where(and(inArray(businesses.ownerId, userIds), isNull(businesses.deletedAt)))
    : [];
  const firstBusinessOf = new Map<string, string>();
  for (const b of owned) if (!firstBusinessOf.has(b.ownerId)) firstBusinessOf.set(b.ownerId, b.id);
  const businessIds = [...new Set([...plans.map((p) => p.businessId), ...owned.map((b) => b.id)])];
  const names = businessIds.length ? await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(inArray(businesses.id, businessIds)) : [];
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  const userNames = userIds.length ? await db.select({ id: users.id, name: users.fullName }).from(users).where(inArray(users.id, userIds)) : [];
  const userName = new Map(userNames.map((u) => [u.id, u.name]));

  const docs: AdminDoc[] = invoices.map((inv) => {
    const customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer?.id ?? null);
    const userId = customerId ? (userByCustomer.get(customerId) ?? null) : null;
    const sub = subscriptionOf(inv);
    const businessId = (sub ? businessBySub.get(sub) : undefined) ?? (userId ? firstBusinessOf.get(userId) : undefined) ?? null;
    const line = inv.lines?.data?.[0];
    const ht = inv.total_excluding_tax ?? inv.total;
    return {
      id: inv.id!,
      kind: "invoice",
      number: inv.number,
      status: inv.status ?? "draft",
      date: new Date(inv.created * 1000),
      paidAt: ts(inv.status_transitions?.paid_at),
      periodStart: ts(line?.period?.start),
      periodEnd: ts(line?.period?.end),
      description: (line?.description ?? inv.description ?? "").replace(/^1 × /, "").replace(/ \(at [^)]*\)$/, ""),
      customerId,
      customerName: inv.customer_name || (userId ? (userName.get(userId) ?? "") : ""),
      customerEmail: inv.customer_email ?? "",
      customerAddress: addr(inv.customer_address),
      customerVat: (inv.customer_tax_ids ?? []).map((t) => t.value).join(", "),
      htCents: ht,
      vatCents: inv.total - ht,
      ttcCents: inv.total,
      refInvoice: null,
      pdf: inv.invoice_pdf ?? null,
      hosted: inv.hosted_invoice_url ?? null,
      userId,
      businessId,
      businessName: businessId ? (nameOf.get(businessId) ?? null) : null,
    };
  });

  const byInvoice = new Map(docs.map((d) => [d.id, d]));
  for (const cn of credits) {
    const invId = typeof cn.invoice === "string" ? cn.invoice : cn.invoice?.id;
    const src = invId ? byInvoice.get(invId) : undefined;
    const ht = cn.total_excluding_tax ?? cn.total;
    docs.push({
      id: cn.id,
      kind: "credit",
      number: cn.number,
      status: cn.status === "void" ? "void" : "issued",
      date: new Date(cn.created * 1000),
      paidAt: null,
      periodStart: src?.periodStart ?? null,
      periodEnd: src?.periodEnd ?? null,
      description: cn.memo || (cn.reason ? `Note de crédit (${cn.reason})` : "Note de crédit"),
      customerId: src?.customerId ?? (typeof cn.customer === "string" ? cn.customer : (cn.customer?.id ?? null)),
      customerName: src?.customerName ?? "",
      customerEmail: src?.customerEmail ?? "",
      customerAddress: src?.customerAddress ?? "",
      customerVat: src?.customerVat ?? "",
      htCents: ht,
      vatCents: cn.total - ht,
      ttcCents: cn.total,
      refInvoice: src?.number ?? null,
      pdf: cn.pdf ?? null,
      hosted: null,
      userId: src?.userId ?? null,
      businessId: src?.businessId ?? null,
      businessName: src?.businessName ?? null,
    });
  }

  docs.sort((a, b) => b.date.getTime() - a.date.getTime());
  return { docs, configured: true, truncated: invoices.length >= MAX || credits.length >= MAX };
}

/** Filtres de la liste (adresse de la page) : statut, recherche, période (aaaa ou aaaa-mm). */
export function filterDocs(docs: AdminDoc[], f: { status?: string; q?: string; period?: string }) {
  const q = f.q?.trim().toLowerCase() ?? "";
  return docs.filter((d) => {
    if (f.status === "credit" ? d.kind !== "credit" : f.status && f.status !== "all" && (d.kind !== "invoice" || d.status !== f.status)) return false;
    if (f.period && !d.date.toISOString().startsWith(f.period)) return false;
    if (q && ![d.number, d.customerName, d.customerEmail, d.customerVat, d.businessName, d.description].some((v) => v?.toLowerCase().includes(q))) return false;
    return true;
  });
}

/** Encaissé = factures payées moins notes de crédit émises. */
export function totalsOf(docs: AdminDoc[]) {
  let ht = 0, vat = 0, ttc = 0, open = 0, paid = 0;
  for (const d of docs) {
    if (d.kind === "invoice" && d.status === "paid") { ht += d.htCents; vat += d.vatCents; ttc += d.ttcCents; paid++; }
    if (d.kind === "credit" && d.status === "issued") { ht -= d.htCents; vat -= d.vatCents; ttc -= d.ttcCents; }
    if (d.kind === "invoice" && d.status === "open") open += d.ttcCents;
  }
  return { ht, vat, ttc, open, paid };
}

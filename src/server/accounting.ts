import "server-only";
import { and, eq, gte, inArray, isNotNull, lte, sql, type AnyColumn } from "drizzle-orm";
import { db } from "@/db";
import { expenses, posSales, salesDocuments, shopOrders } from "@/db/schema";
import { periodRange, sumByRate, type RateRow } from "@/lib/accounting";
import { totals, type SalesLine } from "@/lib/invoicing";
import { cartTotals, type CartLine } from "@/lib/stock";

const c = (euros: number) => Math.round(euros * 100);

/**
 * Ventes facturées (factures − notes de crédit), caisse (tickets − remboursements du mois du remboursement),
 * boutique en ligne (commandes confirmées), dépenses, sur une période (AAAA-MM-JJ inclus).
 * Chaque facture utilise le régime de TVA figé sur le document au moment de son émission.
 */
export async function accountingFor(businessId: string, from: string, to: string, regime: "franchise" | "assujetti", tz: string) {
  const inPeriod = (col: AnyColumn) => sql`(${col} at time zone ${tz})::date between ${from}::date and ${to}::date`;
  const [docs, pos, refunds, shop, exp] = await Promise.all([
    db
      .select({ docType: salesDocuments.docType, lines: salesDocuments.lines, ht: salesDocuments.htCents, vat: salesDocuments.vatCents, seller: salesDocuments.seller })
      .from(salesDocuments)
      .where(and(eq(salesDocuments.businessId, businessId), inArray(salesDocuments.docType, ["invoice", "credit"]), isNotNull(salesDocuments.number), gte(salesDocuments.issueDate, from), lte(salesDocuments.issueDate, to))),
    // Un ticket remboursé plus tard reste une vente de son mois ; le remboursement est déduit le mois où il a lieu.
    db
      .select({ lines: posSales.lines, discount: posSales.discountCents, total: posSales.totalCents, vat: posSales.vatCents })
      .from(posSales)
      .where(and(eq(posSales.businessId, businessId), inArray(posSales.status, ["paid", "refunded"]), inPeriod(posSales.createdAt))),
    db
      .select({ lines: posSales.lines, discount: posSales.discountCents, total: posSales.totalCents, vat: posSales.vatCents })
      .from(posSales)
      .where(and(eq(posSales.businessId, businessId), eq(posSales.status, "refunded"), isNotNull(posSales.refundedAt), inPeriod(posSales.refundedAt))),
    db
      .select({ lines: shopOrders.lines, delivery: shopOrders.deliveryCents, total: shopOrders.totalCents })
      .from(shopOrders)
      .where(and(eq(shopOrders.businessId, businessId), inArray(shopOrders.status, ["new", "ready", "shipped", "done"]), inPeriod(shopOrders.createdAt))),
    db.select({ amount: expenses.amountCents, vat: expenses.vatCents, category: expenses.category }).from(expenses).where(and(eq(expenses.businessId, businessId), gte(expenses.date, from), lte(expenses.date, to))),
  ]);
  const invoiceRows: RateRow[] = [];
  let invoicesHt = 0, invoicesVat = 0, credits = 0, creditsVat = 0;
  for (const d of docs) {
    const sign = d.docType === "credit" ? -1 : 1;
    const docRegime = d.seller?.vatRegime === "assujetti" || d.seller?.vatRegime === "franchise" ? d.seller.vatRegime : regime;
    const t = totals(d.lines as SalesLine[], docRegime);
    if (docRegime === "assujetti") for (const r of t.vatRows) invoiceRows.push({ rate: r.rate, base: sign * c(r.base), vat: sign * c(r.amt) });
    else invoiceRows.push({ rate: 0, base: sign * c(t.ht), vat: 0 });
    if (sign > 0) { invoicesHt += d.ht; invoicesVat += d.vat; } else { credits += d.ht; creditsVat += d.vat; }
  }
  const asg = regime === "assujetti";
  const ticketRows = (lines: CartLine[], discount: number, sign: number) =>
    cartTotals(lines, discount).byRate.map((r) => ({ rate: asg ? r.rate : 0, base: sign * (r.ttc - (asg ? r.vat : 0)), vat: sign * (asg ? r.vat : 0) }));
  const posRows: RateRow[] = [];
  let posTtc = 0, posVat = 0, refundTtc = 0;
  for (const s of pos) { posRows.push(...ticketRows(s.lines, s.discount, 1)); posTtc += s.total; posVat += s.vat; }
  for (const s of refunds) { posRows.push(...ticketRows(s.lines, s.discount, -1)); refundTtc += s.total; posVat -= s.vat; }
  const shopRows: RateRow[] = [];
  let shopTtc = 0;
  for (const o of shop) {
    const lines: CartLine[] = [...o.lines.map((l) => ({ qty: l.qty, unitCents: l.unitCents, vatRate: l.vatRate })), ...(o.delivery ? [{ qty: 1, unitCents: o.delivery, vatRate: 21 }] : [])];
    shopRows.push(...ticketRows(lines, 0, 1));
    shopTtc += o.total;
  }
  const sales = sumByRate([...invoiceRows, ...posRows, ...shopRows]);
  const expTtc = exp.reduce((a, e) => a + e.amount, 0);
  const expVat = asg ? exp.reduce((a, e) => a + e.vat, 0) : 0;
  const byCat = new Map<string, number>();
  for (const e of exp) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount - (asg ? e.vat : 0));
  return {
    sales,
    salesHt: sales.reduce((a, r) => a + r.base, 0),
    vatDue: sales.reduce((a, r) => a + r.vat, 0),
    invoices: { count: docs.filter((d) => d.docType === "invoice").length, ht: invoicesHt, vat: invoicesVat, credits, creditsVat },
    pos: { count: pos.length, ttc: posTtc - refundTtc, vat: posVat, refunds: refunds.length },
    shop: { count: shop.length, ttc: shopTtc },
    expenses: { count: exp.length, ttc: expTtc, vat: expVat, ht: expTtc - expVat, byCategory: [...byCat].sort((a, b) => b[1] - a[1]) },
  };
}

/** Factures émises pas encore payées (à encaisser), dont en retard. */
export async function receivables(businessId: string, today: string) {
  const rows = await db
    .select({ id: salesDocuments.id, number: salesDocuments.number, client: salesDocuments.client, ttc: salesDocuments.ttcCents, due: salesDocuments.dueDate })
    .from(salesDocuments)
    .where(and(eq(salesDocuments.businessId, businessId), eq(salesDocuments.docType, "invoice"), eq(salesDocuments.status, "sent"), isNotNull(salesDocuments.number)))
    .orderBy(salesDocuments.dueDate)
    .limit(500);
  return { rows, total: rows.reduce((a, r) => a + r.ttc, 0), overdue: rows.filter((r) => r.due && r.due < today).reduce((a, r) => a + r.ttc, 0) };
}

/** Recettes et dépenses HTVA des 12 derniers mois (mêmes règles que la déclaration, mois par mois). */
export async function monthlySeries(businessId: string, today: string, regime: "franchise" | "assujetti", tz: string) {
  const d = new Date(`${today.slice(0, 7)}-15T12:00:00Z`);
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() - i); months.push(x.toISOString().slice(0, 7)); }
  return Promise.all(
    months.map(async (m) => {
      const r = periodRange({ kind: "month", year: Number(m.slice(0, 4)), index: Number(m.slice(5, 7)) });
      const a = await accountingFor(businessId, r.from, r.to, regime, tz);
      return { month: m, income: a.salesHt, expenses: a.expenses.ht };
    }),
  );
}

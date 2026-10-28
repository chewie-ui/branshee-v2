import "server-only";
import { and, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenses, posSales, salesDocuments } from "@/db/schema";
import { sumByRate, type RateRow } from "@/lib/accounting";
import { totals, type SalesLine } from "@/lib/invoicing";
import { cartTotals } from "@/lib/stock";

const c = (euros: number) => Math.round(euros * 100);

/** Ventes facturées (factures − notes de crédit), ventes de caisse, dépenses, sur une période (AAAA-MM-JJ inclus). */
export async function accountingFor(businessId: string, from: string, to: string, regime: "franchise" | "assujetti", tz: string) {
  const [docs, pos, exp] = await Promise.all([
    db
      .select({ docType: salesDocuments.docType, lines: salesDocuments.lines, ht: salesDocuments.htCents, vat: salesDocuments.vatCents, number: salesDocuments.number })
      .from(salesDocuments)
      .where(and(eq(salesDocuments.businessId, businessId), inArray(salesDocuments.docType, ["invoice", "credit"]), isNotNull(salesDocuments.number), gte(salesDocuments.issueDate, from), lte(salesDocuments.issueDate, to))),
    db
      .select({ lines: posSales.lines, discount: posSales.discountCents, total: posSales.totalCents, vat: posSales.vatCents })
      .from(posSales)
      .where(and(eq(posSales.businessId, businessId), eq(posSales.status, "paid"), sql`(${posSales.createdAt} at time zone ${tz})::date between ${from}::date and ${to}::date`)),
    db.select({ amount: expenses.amountCents, vat: expenses.vatCents, category: expenses.category }).from(expenses).where(and(eq(expenses.businessId, businessId), gte(expenses.date, from), lte(expenses.date, to))),
  ]);
  const invoiceRows: RateRow[] = [];
  let invoicesHt = 0, invoicesVat = 0, credits = 0, creditsVat = 0;
  for (const d of docs) {
    const sign = d.docType === "credit" ? -1 : 1;
    const t = totals(d.lines as SalesLine[], regime);
    if (regime === "assujetti") for (const r of t.vatRows) invoiceRows.push({ rate: r.rate, base: sign * c(r.base), vat: sign * c(r.amt) });
    else invoiceRows.push({ rate: 0, base: sign * c(t.ht), vat: 0 });
    if (sign > 0) { invoicesHt += d.ht; invoicesVat += d.vat; } else { credits += d.ht; creditsVat += d.vat; }
  }
  const posRows: RateRow[] = [];
  let posTtc = 0, posVat = 0;
  for (const s of pos) {
    const t = cartTotals(s.lines, s.discount);
    for (const r of t.byRate) posRows.push({ rate: regime === "assujetti" ? r.rate : 0, base: r.ttc - (regime === "assujetti" ? r.vat : 0), vat: regime === "assujetti" ? r.vat : 0 });
    posTtc += s.total; posVat += s.vat;
  }
  const sales = sumByRate([...invoiceRows, ...posRows]);
  const expTtc = exp.reduce((a, e) => a + e.amount, 0);
  const expVat = regime === "assujetti" ? exp.reduce((a, e) => a + e.vat, 0) : 0;
  const byCat = new Map<string, number>();
  for (const e of exp) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount - (regime === "assujetti" ? e.vat : 0));
  return {
    sales,
    salesHt: sales.reduce((a, r) => a + r.base, 0),
    vatDue: sales.reduce((a, r) => a + r.vat, 0),
    invoices: { count: docs.filter((d) => d.docType === "invoice").length, ht: invoicesHt, vat: invoicesVat, credits, creditsVat },
    pos: { count: pos.length, ttc: posTtc, vat: posVat },
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

/** Recettes et dépenses HTVA des 12 derniers mois (graphique de trésorerie). */
export async function monthlySeries(businessId: string, today: string, regime: "franchise" | "assujetti", tz: string) {
  const months: string[] = [];
  const d = new Date(`${today.slice(0, 7)}-15T12:00:00Z`);
  for (let i = 11; i >= 0; i--) { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() - i); months.push(x.toISOString().slice(0, 7)); }
  const from = `${months[0]}-01`;
  const [inv, pos, exp] = await Promise.all([
    db.select({ m: sql<string>`to_char(${salesDocuments.issueDate}, 'YYYY-MM')`, v: sql<number>`sum(case when ${salesDocuments.docType} = 'credit' then -${salesDocuments.htCents} else ${salesDocuments.htCents} end)::int` }).from(salesDocuments).where(and(eq(salesDocuments.businessId, businessId), inArray(salesDocuments.docType, ["invoice", "credit"]), isNotNull(salesDocuments.number), gte(salesDocuments.issueDate, from))).groupBy(sql`1`),
    db.select({ m: sql<string>`to_char(${posSales.createdAt} at time zone ${tz}, 'YYYY-MM')`, v: sql<number>`sum(${posSales.totalCents} - ${regime === "assujetti" ? posSales.vatCents : sql`0`})::int` }).from(posSales).where(and(eq(posSales.businessId, businessId), eq(posSales.status, "paid"), sql`(${posSales.createdAt} at time zone ${tz})::date >= ${from}::date`)).groupBy(sql`1`),
    db.select({ m: sql<string>`to_char(${expenses.date}, 'YYYY-MM')`, v: sql<number>`sum(${expenses.amountCents} - ${regime === "assujetti" ? expenses.vatCents : sql`0`})::int` }).from(expenses).where(and(eq(expenses.businessId, businessId), gte(expenses.date, from))).groupBy(sql`1`),
  ]);
  const get = (rows: { m: string; v: number }[], m: string) => rows.find((r) => r.m === m)?.v ?? 0;
  return months.map((m) => ({ month: m, income: get(inv, m) + get(pos, m), expenses: get(exp, m) }));
}

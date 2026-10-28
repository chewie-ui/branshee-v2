import { and, asc, eq, gte, inArray, isNotNull, lte, sql, type AnyColumn } from "drizzle-orm";
import { db } from "@/db";
import { expenses, posSales, salesDocuments, shopOrders } from "@/db/schema";
import { parsePeriod, periodKey, periodRange } from "@/lib/accounting";
import { todayIn } from "@/lib/planning";
import { cartTotals } from "@/lib/stock";
import { requireContext } from "@/server/context";
import { getSellerSettings } from "@/server/invoicing";
import { csvResponse, toCsv } from "@/server/csv";

/** Journal de la période pour le comptable : factures, notes de crédit, tickets et remboursements de caisse, commandes en ligne et dépenses (une ligne chacun). */
export async function GET(req: Request) {
  const ctx = await requireContext("invoices.view");
  const tz = ctx.business.timezone || "Europe/Brussels";
  const p = parsePeriod(new URL(req.url).searchParams.get("p") ?? undefined, todayIn(tz));
  const { from, to } = periodRange(p);
  const assujetti = (await getSellerSettings(ctx.business.id)).vatRegime === "assujetti";
  const inP = (col: AnyColumn) => sql`(${col} at time zone ${tz})::date between ${from}::date and ${to}::date`;
  const [docs, pos, refunds, shop, exp] = await Promise.all([
    db.select().from(salesDocuments).where(and(eq(salesDocuments.businessId, ctx.business.id), inArray(salesDocuments.docType, ["invoice", "credit"]), isNotNull(salesDocuments.number), gte(salesDocuments.issueDate, from), lte(salesDocuments.issueDate, to))).orderBy(asc(salesDocuments.issueDate)),
    db.select({ number: posSales.number, total: posSales.totalCents, vat: posSales.vatCents, method: posSales.method, status: posSales.status, day: sql<string>`to_char(${posSales.createdAt} at time zone ${tz}, 'YYYY-MM-DD')` }).from(posSales).where(and(eq(posSales.businessId, ctx.business.id), inArray(posSales.status, ["paid", "refunded"]), inP(posSales.createdAt))).orderBy(asc(posSales.createdAt)),
    db.select({ number: posSales.number, total: posSales.totalCents, vat: posSales.vatCents, day: sql<string>`to_char(${posSales.refundedAt} at time zone ${tz}, 'YYYY-MM-DD')` }).from(posSales).where(and(eq(posSales.businessId, ctx.business.id), eq(posSales.status, "refunded"), isNotNull(posSales.refundedAt), inP(posSales.refundedAt))),
    db.select({ number: shopOrders.number, name: shopOrders.name, lines: shopOrders.lines, delivery: shopOrders.deliveryCents, total: shopOrders.totalCents, paid: shopOrders.paidAt, day: sql<string>`to_char(${shopOrders.createdAt} at time zone ${tz}, 'YYYY-MM-DD')` }).from(shopOrders).where(and(eq(shopOrders.businessId, ctx.business.id), inArray(shopOrders.status, ["new", "ready", "shipped", "done"]), inP(shopOrders.createdAt))),
    db.select().from(expenses).where(and(eq(expenses.businessId, ctx.business.id), gte(expenses.date, from), lte(expenses.date, to))).orderBy(asc(expenses.date)),
  ]);
  const n = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const rows: (string | null)[][] = [
    ...docs.map((d) => { const s = d.docType === "credit" ? -1 : 1; return [d.issueDate, d.docType === "credit" ? "Note de crédit" : "Facture", d.number, String(d.client?.name ?? ""), String(d.client?.vat ?? ""), n(s * d.htCents), n(s * d.vatCents), n(s * d.ttcCents), d.docType === "credit" ? "Note de crédit" : d.status === "paid" ? `Payée le ${d.paidDate ?? ""}` : d.status === "cancelled" ? "Annulée par note de crédit" : "À encaisser"]; }),
    ...pos.map((t) => [t.day, "Ticket de caisse", t.number, "", "", n(t.total - t.vat), n(t.vat), n(t.total), `${t.method === "cash" ? "Espèces" : t.method === "card" ? "Carte" : "Autre"}${t.status === "refunded" ? " · remboursé ensuite" : ""}`]),
    ...refunds.map((t) => [t.day, "Remboursement caisse", t.number, "", "", n(-(t.total - t.vat)), n(-t.vat), n(-t.total), "Remboursement du ticket"]),
    ...shop.map((o) => { const v = !assujetti ? 0 : cartTotals([...o.lines, ...(o.delivery ? [{ qty: 1, unitCents: o.delivery, vatRate: 21 }] : [])]).vat; return [o.day, "Commande en ligne", `C${o.number}`, o.name, "", n(o.total - v), n(v), n(o.total), o.paid ? "Payée" : "À encaisser"]; }),
    ...exp.map((e) => [e.date, "Dépense", "", e.supplier, "", n(-(e.amountCents - e.vatCents)), n(-e.vatCents), n(-e.amountCents), `${e.category}${e.proofName ? "" : " · justificatif manquant"}`]),
  ].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const csv = toCsv(["Date", "Type", "Numéro", "Tiers", "N° TVA du client", "HTVA", "TVA", "TVAC", "Remarque"], rows);
  return csvResponse(`comptabilite-${periodKey(p)}.csv`, csv);
}

import { and, asc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenses, posSales, salesDocuments } from "@/db/schema";
import { parsePeriod, periodKey, periodRange } from "@/lib/accounting";
import { todayIn } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { csvResponse, toCsv } from "@/server/csv";

/** Journal de la période pour le comptable : factures, notes de crédit, tickets de caisse et dépenses (une ligne chacun). */
export async function GET(req: Request) {
  const ctx = await requireContext("invoices.view");
  const tz = ctx.business.timezone || "Europe/Brussels";
  const p = parsePeriod(new URL(req.url).searchParams.get("p") ?? undefined, todayIn(tz));
  const { from, to } = periodRange(p);
  const [docs, pos, exp] = await Promise.all([
    db.select().from(salesDocuments).where(and(eq(salesDocuments.businessId, ctx.business.id), inArray(salesDocuments.docType, ["invoice", "credit"]), isNotNull(salesDocuments.number), gte(salesDocuments.issueDate, from), lte(salesDocuments.issueDate, to))).orderBy(asc(salesDocuments.issueDate)),
    db.select({ number: posSales.number, total: posSales.totalCents, vat: posSales.vatCents, method: posSales.method, status: posSales.status, day: sql<string>`to_char(${posSales.createdAt} at time zone ${tz}, 'YYYY-MM-DD')` }).from(posSales).where(and(eq(posSales.businessId, ctx.business.id), sql`(${posSales.createdAt} at time zone ${tz})::date between ${from}::date and ${to}::date`)).orderBy(asc(posSales.createdAt)),
    db.select().from(expenses).where(and(eq(expenses.businessId, ctx.business.id), gte(expenses.date, from), lte(expenses.date, to))).orderBy(asc(expenses.date)),
  ]);
  const n = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const rows: (string | null)[][] = [
    ...docs.map((d) => { const s = d.docType === "credit" ? -1 : 1; return [d.issueDate, d.docType === "credit" ? "Note de crédit" : "Facture", d.number, String(d.client?.name ?? ""), String(d.client?.vat ?? ""), n(s * d.htCents), n(s * d.vatCents), n(s * d.ttcCents), d.docType === "credit" ? "Note de crédit" : d.status === "paid" ? `Payée le ${d.paidDate ?? ""}` : d.status === "cancelled" ? "Annulée par note de crédit" : "À encaisser"]; }),
    ...pos.map((t) => [t.day, "Ticket de caisse", t.number, "", "", n(t.status === "paid" ? t.total - t.vat : 0), n(t.status === "paid" ? t.vat : 0), n(t.status === "paid" ? t.total : 0), t.status === "refunded" ? "Remboursé" : t.method === "cash" ? "Espèces" : t.method === "card" ? "Carte" : "Autre"]),
    ...exp.map((e) => [e.date, "Dépense", "", e.supplier, "", n(-(e.amountCents - e.vatCents)), n(-e.vatCents), n(-e.amountCents), `${e.category}${e.proofName ? "" : " · justificatif manquant"}`]),
  ].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const csv = toCsv(["Date", "Type", "Numéro", "Tiers", "N° TVA du client", "HTVA", "TVA", "TVAC", "Remarque"], rows);
  return csvResponse(`comptabilite-${periodKey(p)}.csv`, csv);
}

import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { requireContext } from "@/server/context";
import { csvResponse, toCsv } from "@/server/csv";

/** Export comptable des dépenses d'une année (montants en euros, virgule décimale). */
export async function GET(req: Request) {
  const ctx = await requireContext("invoices.view");
  const y = Number(new URL(req.url).searchParams.get("annee"));
  const year = y >= 2000 && y <= 2100 ? y : new Date().getFullYear();
  const rows = await db.select().from(expenses).where(and(eq(expenses.businessId, ctx.business.id), gte(expenses.date, `${year}-01-01`), lte(expenses.date, `${year}-12-31`))).orderBy(asc(expenses.date));
  const n = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const csv = toCsv(
    ["Date", "Fournisseur", "Catégorie", "Description", "Montant TVAC", "TVA", "Montant HTVA", "Justificatif"],
    rows.map((e) => [e.date, e.supplier, e.category, e.description, n(e.amountCents), n(e.vatCents), n(e.amountCents - e.vatCents), e.proofName ?? "manquant"]),
  );
  return csvResponse(`depenses-${year}.csv`, csv);
}

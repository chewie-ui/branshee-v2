import { getSessionUser } from "@/server/auth/session";
import { csvResponse, toCsv } from "@/server/csv";
import { filterDocs, listAdminDocuments, STATUS_LABEL } from "@/server/admin-invoices";

/** Export comptable : factures et notes de crédit (montants en euros, virgule décimale). */
export async function GET(req: Request) {
  const s = await getSessionUser();
  if (!s?.user.isSuperadmin || s.impersonatedById) return new Response("Introuvable", { status: 404 });
  const p = new URL(req.url).searchParams.get("periode") ?? "";
  const period = /^\d{4}(-\d{2})?$/.test(p) ? p : "";
  const { docs } = await listAdminDocuments();
  const rows = filterDocs(docs, { period }).sort((a, b) => a.date.getTime() - b.date.getTime());
  const n = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : "");
  const csv = toCsv(
    ["Type", "Numéro", "Date", "Statut", "Payée le", "Facture d'origine", "Client", "Email", "Adresse", "N° TVA client", "Objet", "Période du", "Période au", "HTVA", "TVA", "TVAC", "Établissement"],
    rows.map((r) => [
      r.kind === "credit" ? "Note de crédit" : "Facture",
      r.number,
      d(r.date),
      r.kind === "credit" ? (r.status === "void" ? "Annulée" : "Émise") : (STATUS_LABEL[r.status] ?? r.status),
      d(r.paidAt),
      r.refInvoice,
      r.customerName,
      r.customerEmail,
      r.customerAddress,
      r.customerVat,
      r.description,
      d(r.periodStart),
      d(r.periodEnd),
      n(r.htCents),
      n(r.vatCents),
      n(r.ttcCents),
      r.businessName,
    ]),
  );
  return csvResponse(`branshee-factures-${period || new Date().toISOString().slice(0, 10)}.csv`, csv);
}

import { buildUbl, ublMissing } from "@/lib/ubl";
import { requireContext } from "@/server/context";
import { getDocument } from "@/server/invoicing";

/** Fichier UBL (Peppol BIS 3.0) d'une facture ou note de crédit émise. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("invoices.view");
  const d = await getDocument(ctx.business.id, (await params).id);
  if (!d || d.docType === "quote" || !d.number || !d.seller || !d.client) return new Response("Seules les factures émises ont une version électronique.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const rel = d.relatedId ? await getDocument(ctx.business.id, d.relatedId) : null;
  const input = { docType: d.docType as "invoice" | "credit", number: d.number, issueDate: d.issueDate, dueDate: d.dueDate, serviceDate: d.serviceDate, comm: d.comm, notes: d.notes, lines: d.lines, seller: d.seller, client: d.client, relatedNumber: rel?.number ?? null };
  const missing = ublMissing(input);
  if (missing.length) return new Response(`Il manque : ${missing.join(", ")}.`, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(buildUbl(input), { headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${d.number.replace(/[^\w.-]+/g, "_")}.xml"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

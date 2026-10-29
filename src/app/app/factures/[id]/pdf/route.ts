import type { DocParty } from "@/components/invoicing/invoice-document";
import { requireContext } from "@/server/context";
import { invoicePdf, pdfFileName } from "@/server/invoice-pdf";
import { customerOptions, getDocument, getSellerSettings, paymentQr, relatedDocuments } from "@/server/invoicing";

/** Téléchargement du PDF d'une facture, note de crédit ou devis (équipe de l'entreprise). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("invoices.view", { app: "factures" });
  const d = await getDocument(ctx.business.id, (await params).id);
  if (!d) return new Response("Introuvable", { status: 404 });
  const [settings, customers, rel, qr] = await Promise.all([getSellerSettings(ctx.business.id), customerOptions(ctx.business.id), relatedDocuments(ctx.business.id, d), paymentQr(d)]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { saved: _saved, ...current } = settings;
  const c = customers.find((x) => x.id === d.customerId);
  const client: DocParty | null = d.client ?? (c ? { name: c.company || c.name, contact: c.company ? c.name : "", street: c.street ?? "", zip: c.postalCode ?? "", city: c.city ?? "", country: c.country ?? "", vat: c.vatNumber ?? "" } : null);
  const buf = await invoicePdf({ doc: { ...d, related: rel.linked }, seller: d.seller ?? current, client, qr });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(pdfFileName(d))}`, "Cache-Control": "private, no-store" } });
}

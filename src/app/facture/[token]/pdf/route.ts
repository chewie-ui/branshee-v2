import { invoiceByToken } from "@/server/invoice-mailing";
import { invoicePdf, pdfFileName } from "@/server/invoice-pdf";
import { paymentQr, relatedDocuments } from "@/server/invoicing";

/** PDF de la facture émise derrière le lien envoyé au client. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const r = await invoiceByToken((await params).token);
  if (!r) return new Response("Introuvable", { status: 404 });
  const d = r.d;
  const [rel, qr] = await Promise.all([relatedDocuments(d.businessId, d), d.status === "sent" ? paymentQr(d) : null]);
  const buf = await invoicePdf({ doc: { ...d, related: rel.linked }, seller: d.seller ?? {}, client: d.client ?? null, qr });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(pdfFileName(d))}`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}

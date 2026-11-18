import { getSessionUser } from "@/server/auth/session";
import { myInvoice } from "@/server/client-account";
import { invoicePdf, pdfFileName } from "@/server/invoice-pdf";
import { paymentQr, relatedDocuments } from "@/server/invoicing";

/** PDF d'une facture ou note de crédit du client connecté (email vérifié, fiche rattachée à son compte). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSessionUser();
  if (!s?.user.emailVerifiedAt) return new Response("Connexion requise", { status: 401 });
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Introuvable", { status: 404 });
  const d = await myInvoice(s.user.id, id);
  if (!d) return new Response("Introuvable", { status: 404 });
  const [rel, qr] = await Promise.all([relatedDocuments(d.businessId, d), d.status === "sent" && d.docType === "invoice" ? paymentQr(d) : null]);
  const buf = await invoicePdf({ doc: { ...d, related: rel.linked }, seller: d.seller ?? {}, client: d.client ?? null, qr });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(pdfFileName(d))}`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}

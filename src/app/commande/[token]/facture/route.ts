import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { salesDocuments } from "@/db/schema";
import { invoicePdf, pdfFileName } from "@/server/invoice-pdf";
import { relatedDocuments } from "@/server/invoicing";
import { orderByToken } from "@/server/shop";

/** PDF de la facture d'une commande, derrière le lien secret de la commande. ?nc=1 : la note de crédit si elle existe. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const r = await orderByToken((await params).token);
  if (!r?.o.invoiceId) return new Response("Introuvable", { status: 404 });
  const credit = new URL(req.url).searchParams.get("nc") === "1";
  const [d] = credit
    ? await db.select().from(salesDocuments).where(and(eq(salesDocuments.businessId, r.o.businessId), eq(salesDocuments.relatedId, r.o.invoiceId), eq(salesDocuments.docType, "credit")))
    : await db.select().from(salesDocuments).where(and(eq(salesDocuments.businessId, r.o.businessId), eq(salesDocuments.id, r.o.invoiceId)));
  if (!d || !d.number || d.status === "draft") return new Response("Introuvable", { status: 404 });
  const rel = await relatedDocuments(d.businessId, d);
  const buf = await invoicePdf({ doc: { ...d, related: rel.linked }, seller: d.seller ?? {}, client: d.client ?? null, qr: null });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(pdfFileName(d))}`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}

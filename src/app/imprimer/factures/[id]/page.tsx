import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvoiceDocument, type DocParty } from "@/components/invoicing/invoice-document";
import { PrintToolbar } from "@/components/invoicing/print-toolbar";
import { docTitle } from "@/lib/invoicing";
import { requireContext } from "@/server/context";
import { customerOptions, getDocument, getSellerSettings, paymentQr, relatedDocuments } from "@/server/invoicing";

export const dynamic = "force-dynamic";

/** Le titre de la page sert de nom au PDF enregistré (« Facture SKY-2026-001 »). */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ctx = await requireContext("invoices.view");
  const d = await getDocument(ctx.business.id, (await params).id);
  return { title: { absolute: d ? `${docTitle(d.docType)} ${d.number ?? "brouillon"}` : "Document" }, robots: { index: false } };
}

/** Version imprimable (A4) : « Enregistrer en PDF » depuis la fenêtre d'impression du navigateur. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("invoices.view");
  const d = await getDocument(ctx.business.id, (await params).id);
  if (!d) notFound();
  const [settings, customers, rel, qr] = await Promise.all([getSellerSettings(ctx.business.id), customerOptions(ctx.business.id), relatedDocuments(ctx.business.id, d), paymentQr(d)]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { saved: _saved, ...current } = settings;
  const c = customers.find((x) => x.id === d.customerId);
  const client: DocParty | null = d.client ?? (c ? { name: c.company || c.name, contact: c.company ? c.name : "", street: c.street ?? "", zip: c.postalCode ?? "", city: c.city ?? "", country: c.country ?? "", vat: c.vatNumber ?? "" } : null);
  return (
    <div className="min-h-dvh bg-surface-muted py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 0; } @media print { html, body { background: #fff; } }`}</style>
      <PrintToolbar />
      <div className="mx-auto w-[794px] shadow-lg print:shadow-none">
        <InvoiceDocument doc={{ ...d, related: rel.linked }} seller={d.seller ?? current} client={client} qr={qr} />
      </div>
    </div>
  );
}

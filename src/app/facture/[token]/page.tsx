import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/db";
import { invoiceMailings } from "@/db/schema";
import { A4Frame } from "@/components/invoicing/a4-frame";
import { InvoiceDocument } from "@/components/invoicing/invoice-document";
import { PrintButton } from "@/components/invoicing/print-button";
import { fdate, ibanFmt } from "@/lib/invoicing";
import { invoiceByToken, eur } from "@/server/invoice-mailing";
import { paymentQr } from "@/server/invoicing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Votre facture" }, robots: { index: false, follow: false } };

/** Lien envoyé au client : la facture émise, à télécharger et à payer (QR code bancaire). */
export default async function PublicInvoice({ params }: { params: Promise<{ token: string }> }) {
  const r = await invoiceByToken((await params).token);
  if (!r) notFound();
  if (!r.m.viewedAt) await db.update(invoiceMailings).set({ viewedAt: new Date() }).where(eq(invoiceMailings.id, r.m.id));
  const d = r.d;
  const seller = d.seller ?? {};
  const sellerName = String(seller.tradeName || seller.legalName || r.business);
  const credit = d.docType === "credit";
  const paid = d.status === "paid";
  const cancelled = d.status === "cancelled";
  const qr = !credit && !paid && !cancelled ? await paymentQr(d) : null;
  const iban = String(seller.iban ?? "");
  return (
    <div className="min-h-dvh bg-bg print:bg-white">
      <header className="border-b border-border bg-surface print:hidden">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <p className="text-sm text-muted">{sellerName}</p>
          <h1 className="text-xl font-semibold">{credit ? "Note de crédit" : "Facture"} {d.number}</h1>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_300px] print:block print:p-0">
        <div className="min-w-0">
          <A4Frame>
            <InvoiceDocument doc={d} seller={seller} client={d.client ?? null} qr={qr} />
          </A4Frame>
        </div>
        <aside className="order-first h-fit space-y-4 rounded-2xl border border-border bg-surface p-5 lg:order-none print:hidden">
          <div>
            <p className="text-sm text-muted">{credit ? "Montant crédité" : "Montant TVAC"}</p>
            <p className="text-2xl font-semibold tabular-nums">{eur(d.ttcCents)}</p>
          </div>
          {paid ? <p className="inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success" role="status"><CheckCircle2 className="size-4" aria-hidden="true" />Payée{d.paidDate ? ` le ${fdate(d.paidDate)}` : ""}. Merci !</p> : null}
          {cancelled ? <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm" role="status">Cette facture a été annulée par une note de crédit : rien à payer.</p> : null}
          {!credit && !paid && !cancelled ? (
            <div className="space-y-3 text-sm">
              {d.dueDate ? <p>À payer avant le <b>{fdate(d.dueDate)}</b></p> : null}
              {qr ? (
                <div className="rounded-xl border border-border p-3 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="QR code de paiement" className="mx-auto size-40" />
                  <p className="mt-2 text-muted">Scannez avec votre app bancaire : montant et communication sont remplis pour vous.</p>
                </div>
              ) : null}
              {iban ? <p>IBAN <b className="font-mono">{ibanFmt(iban)}</b>{seller.bic ? <span className="text-muted"> · BIC {String(seller.bic)}</span> : null}</p> : null}
              {d.comm ? <p>Communication <b className="font-mono">{d.comm}</b></p> : null}
            </div>
          ) : null}
          <PrintButton />
          <p className="text-xs text-muted">Une question ? Répondez simplement à l&apos;email reçu de {sellerName}.</p>
        </aside>
      </main>
    </div>
  );
}

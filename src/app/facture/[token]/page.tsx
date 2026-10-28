import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/db";
import { invoiceMailings, members, salesDocuments } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
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
  const d = r.d;
  // « Ouverte par le client » : pas quand c'est l'équipe de l'entreprise qui teste le lien.
  if (!r.m.viewedAt) {
    const me = await getSessionUser();
    const [team] = me ? await db.select({ id: members.id }).from(members).where(and(eq(members.businessId, d.businessId), eq(members.userId, me.user.id))) : [];
    if (!team) await db.update(invoiceMailings).set({ viewedAt: new Date() }).where(eq(invoiceMailings.id, r.m.id));
  }
  // Notes de crédit émises sur cette facture : le montant restant dû baisse d'autant.
  const [cr] = d.docType === "invoice" ? await db.select({ c: sql<number>`coalesce(sum(${salesDocuments.ttcCents}), 0)::int` }).from(salesDocuments).where(and(eq(salesDocuments.businessId, d.businessId), eq(salesDocuments.relatedId, d.id), eq(salesDocuments.docType, "credit"), isNotNull(salesDocuments.number))) : [{ c: 0 }];
  const credited = cr?.c ?? 0;
  const due = Math.max(0, d.ttcCents - credited);
  const seller = d.seller ?? {};
  const sellerName = String(seller.tradeName || seller.legalName || r.business);
  const credit = d.docType === "credit";
  const paid = d.status === "paid";
  const cancelled = d.status === "cancelled";
  const qr = !credit && !paid && !cancelled && !credited ? await paymentQr(d) : null;
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
            <p className="text-sm text-muted">{credit ? "Montant crédité" : credited ? "Reste à payer TVAC" : "Montant TVAC"}</p>
            <p className="text-2xl font-semibold tabular-nums">{eur(credit ? d.ttcCents : due)}</p>
            {credited && !credit ? <p className="text-xs text-muted">Facture de {eur(d.ttcCents)}, moins {eur(credited)} de note de crédit.</p> : null}
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
              {credited ? <p className="text-muted">Indiquez le montant restant ({eur(due)}) dans votre virement.</p> : null}
            </div>
          ) : null}
          <PrintButton />
          <p className="text-xs text-muted">Une question ? Répondez simplement à l&apos;email reçu de {sellerName}.</p>
        </aside>
      </main>
    </div>
  );
}

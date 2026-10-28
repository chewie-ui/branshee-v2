import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quoteSignatures } from "@/db/schema";
import { A4Frame } from "@/components/invoicing/a4-frame";
import { InvoiceDocument } from "@/components/invoicing/invoice-document";
import { SignBox } from "@/components/signature/sign-box";
import { docHash, signatureByToken } from "@/server/signatures";
import { intlLocale } from "@/i18n";
import { fill, publicTexts } from "@/i18n/public-pages";
import { resolvePublicLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Signature du devis" }, robots: { index: false, follow: false } };

/** Page envoyée au client : le devis tel qu'il a été envoyé, puis la signature (ou le refus). */
export default async function SignPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string }> }) {
  const locale = await resolvePublicLocale((await searchParams).lang);
  const tx = publicTexts(locale).sign;
  const { token } = await params;
  const r = await signatureByToken(token);
  if (!r || r.sig.cancelledAt) notFound();
  if (!r.sig.viewedAt) await db.update(quoteSignatures).set({ viewedAt: new Date() }).where(eq(quoteSignatures.id, r.sig.id));
  const seller = r.doc.seller ?? {};
  const sellerName = String(seller.tradeName || seller.legalName || r.business.name);
  const changed = docHash(r.doc) !== r.sig.docHash;
  const state = r.sig.signedAt ? "signed" : r.sig.declinedAt ? "declined" : r.sig.expiresAt < new Date() ? "expired" : changed || r.doc.status === "invoiced" || r.doc.status === "refused" ? "changed" : "open";
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <p className="text-sm text-muted">{sellerName}</p>
          <h1 className="text-xl font-semibold">{fill(tx.quote, { n: r.doc.number ?? "" })}</h1>
        </div>
      </header>
      <main className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <A4Frame>
          <InvoiceDocument doc={r.doc} seller={seller} client={r.doc.client ?? null} />
        </A4Frame>
        <SignBox
          token={token}
          state={state}
          amount={r.doc.ttcCents}
          tx={tx}
          intl={intlLocale(locale)}
          signed={r.sig.signedAt ? { name: r.sig.signerName ?? "", at: r.sig.signedAt.toISOString(), path: r.sig.signaturePath ?? "", hash: r.sig.docHash } : null}
        />
      </main>
    </div>
  );
}

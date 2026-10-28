import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { db } from "@/db";
import { invoiceSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { orderByToken } from "@/server/shop";
import { intlLocale } from "@/i18n";
import { fill, publicTexts } from "@/i18n/public-pages";
import { resolvePublicLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Ma commande" }, robots: { index: false, follow: false } };

/** Suivi de commande pour le client (lien reçu par email). */
export default async function OrderTracking({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paye?: string; annule?: string; lang?: string }> }) {
  const r = await orderByToken((await params).token);
  if (!r) notFound();
  const sp = await searchParams;
  const locale = await resolvePublicLocale(sp.lang);
  const tx = publicTexts(locale).shop;
  const eur = (c: number) => new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "EUR" }).format(c / 100);
  const o = r.o;
  const [seller] = o.payMethod === "transfer" ? await db.select({ iban: invoiceSettings.iban, bic: invoiceSettings.bic, name: invoiceSettings.legalName }).from(invoiceSettings).where(eq(invoiceSettings.businessId, o.businessId)) : [];
  const pendingPay = o.status === "pending_payment";
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm text-muted">{r.business}</p>
        <h1 className="mt-1 text-2xl font-semibold">{fill(tx.orderNo, { n: o.number })}</h1>
        <p className="mt-2 inline-flex items-center gap-1.5 font-medium" role="status">{pendingPay ? <Clock className="size-4 text-warning" aria-hidden="true" /> : <CheckCircle2 className="size-4 text-success" aria-hidden="true" />}{pendingPay ? (sp.annule ? tx.payCancelled : tx.payPending) : tx.status[o.status as keyof typeof tx.status] ?? o.status}</p>
        {pendingPay && sp.annule ? <p className="mt-1 text-sm text-muted">{tx.cancelIfUnpaid} <a href={`/boutique/${r.slug}${sp.lang ? `?lang=${encodeURIComponent(sp.lang)}` : ""}`} className="font-medium text-accent">{tx.backShop}</a></p> : null}
        <ul className="mt-4 divide-y divide-border text-sm">
          {o.lines.map((l, i) => <li key={i} className="flex justify-between py-2"><span>{l.qty} × {l.name}</span><span className="tabular-nums">{eur(l.qty * l.unitCents)}</span></li>)}
          {o.deliveryCents ? <li className="flex justify-between py-2"><span>{tx.deliveryLine}</span><span className="tabular-nums">{eur(o.deliveryCents)}</span></li> : null}
          <li className="flex justify-between py-2 font-semibold"><span>{tx.total}</span><span className="tabular-nums">{eur(o.totalCents)}</span></li>
        </ul>
        <p className="mt-3 text-sm">{o.fulfilment === "delivery" ? fill(tx.deliverTo, { address: o.address ?? "" }) : tx.pickupInfo}</p>
        {o.payMethod === "transfer" && !o.paidAt && o.status !== "cancelled" && seller?.iban ? <p className="mt-3 rounded-lg bg-surface-muted p-3 text-sm">{fill(tx.transfer, { amount: eur(o.totalCents), name: seller.name || r.business })}<br />IBAN <b className="font-mono">{seller.iban}</b>{seller.bic ? ` · BIC ${seller.bic}` : ""}<br />{tx.comm} : <b>{fill(tx.commValue, { n: o.number })}</b></p> : null}
        {o.payMethod === "pickup" && !o.paidAt && o.status !== "cancelled" ? <p className="mt-3 text-sm text-muted">{fill(tx.payLater, { when: o.fulfilment === "delivery" ? tx.atDelivery : tx.atPickup })}</p> : null}
      </div>
    </div>
  );
}

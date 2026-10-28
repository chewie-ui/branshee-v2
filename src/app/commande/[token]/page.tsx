import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { db } from "@/db";
import { invoiceSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SHOP_STATUS, type ShopStatus } from "@/lib/shop";
import { orderByToken } from "@/server/shop";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Ma commande" }, robots: { index: false, follow: false } };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

/** Suivi de commande pour le client (lien reçu par email). */
export default async function OrderTracking({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paye?: string; annule?: string }> }) {
  const r = await orderByToken((await params).token);
  if (!r) notFound();
  const sp = await searchParams;
  const o = r.o;
  const [seller] = o.payMethod === "transfer" ? await db.select({ iban: invoiceSettings.iban, bic: invoiceSettings.bic, name: invoiceSettings.legalName }).from(invoiceSettings).where(eq(invoiceSettings.businessId, o.businessId)) : [];
  const pendingPay = o.status === "pending_payment";
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm text-muted">{r.business}</p>
        <h1 className="mt-1 text-2xl font-semibold">Commande n° {o.number}</h1>
        <p className="mt-2 inline-flex items-center gap-1.5 font-medium" role="status">{pendingPay ? <Clock className="size-4 text-warning" aria-hidden="true" /> : <CheckCircle2 className="size-4 text-success" aria-hidden="true" />}{pendingPay ? (sp.annule ? "Paiement annulé" : "Paiement en cours de confirmation…") : SHOP_STATUS[o.status as ShopStatus]?.label ?? o.status}</p>
        {pendingPay && sp.annule ? <p className="mt-1 text-sm text-muted">Votre commande sera annulée si le paiement n&apos;est pas fait. <a href={`/boutique/${r.slug}`} className="font-medium text-accent">Retour à la boutique</a></p> : null}
        <ul className="mt-4 divide-y divide-border text-sm">
          {o.lines.map((l, i) => <li key={i} className="flex justify-between py-2"><span>{l.qty} × {l.name}</span><span className="tabular-nums">{eur(l.qty * l.unitCents)}</span></li>)}
          {o.deliveryCents ? <li className="flex justify-between py-2"><span>Livraison</span><span className="tabular-nums">{eur(o.deliveryCents)}</span></li> : null}
          <li className="flex justify-between py-2 font-semibold"><span>Total TVAC</span><span className="tabular-nums">{eur(o.totalCents)}</span></li>
        </ul>
        <p className="mt-3 text-sm">{o.fulfilment === "delivery" ? `Livraison : ${o.address}` : "Retrait sur place : vous recevrez un email quand elle sera prête."}</p>
        {o.payMethod === "transfer" && !o.paidAt && seller?.iban ? <p className="mt-3 rounded-lg bg-surface-muted p-3 text-sm">Virement de <b>{eur(o.totalCents)}</b> à {seller.name || r.business}<br />IBAN <b className="font-mono">{seller.iban}</b>{seller.bic ? ` · BIC ${seller.bic}` : ""}<br />Communication : <b>Commande {o.number}</b></p> : null}
        {o.payMethod === "pickup" && !o.paidAt ? <p className="mt-3 text-sm text-muted">Paiement {o.fulfilment === "delivery" ? "à la livraison" : "au retrait"}.</p> : null}
      </div>
    </div>
  );
}

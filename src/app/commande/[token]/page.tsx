import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, Gift, UserRound } from "lucide-react";
import { db } from "@/db";
import { customers, invoiceSettings, loyaltyCards } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getSessionUser } from "@/server/auth/session";
import { loyaltySettingsOf } from "@/server/loyalty";
import { orderByToken, pickupCode } from "@/server/shop";
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
  // Fidélité : si la boutique donne un tampon par achat, on montre la carte du client (ou celle qu'il va recevoir).
  const loyalty = await loyaltySettingsOf(o.businessId);
  const [card] = loyalty.autoShop
    ? await db.select({ token: loyaltyCards.token, stamps: loyaltyCards.stamps }).from(loyaltyCards).innerJoin(customers, eq(customers.id, loyaltyCards.customerId)).where(and(eq(loyaltyCards.businessId, o.businessId), sql`lower(${customers.email}) = ${o.email.toLowerCase()}`)).limit(1)
    : [];
  // Compte : connecté avec l'email de la commande → elle est dans « Mes commandes » ; sinon on propose de créer un compte.
  const user = (await getSessionUser())?.user;
  const mine = !!user && user.email.toLowerCase() === o.email.toLowerCase();
  const suite = encodeURIComponent("/espace-client/commandes");
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
        {o.fulfilment === "pickup" && !pendingPay && o.status !== "cancelled" && o.status !== "done" ? (
          <div className="mt-4 rounded-xl border border-border bg-surface-muted p-4 text-center">
            <p className="text-sm font-medium text-muted">{tx.pickupCode}</p>
            <p className="mt-1 font-mono text-4xl font-bold tracking-[0.3em]">{pickupCode(o.token)}</p>
            <p className="mt-2 text-xs text-muted">{tx.pickupCodeHelp}</p>
          </div>
        ) : null}
        {o.payMethod === "transfer" && !o.paidAt && o.status !== "cancelled" && seller?.iban ? <p className="mt-3 rounded-lg bg-surface-muted p-3 text-sm">{fill(tx.transfer, { amount: eur(o.totalCents), name: seller.name || r.business })}<br />IBAN <b className="font-mono">{seller.iban}</b>{seller.bic ? ` · BIC ${seller.bic}` : ""}<br />{tx.comm} : <b>{fill(tx.commValue, { n: o.number })}</b></p> : null}
        {o.payMethod === "pickup" && !o.paidAt && o.status !== "cancelled" ? <p className="mt-3 text-sm text-muted">{fill(tx.payLater, { when: o.fulfilment === "delivery" ? tx.atDelivery : tx.atPickup })}</p> : null}
        {loyalty.autoShop && o.status !== "cancelled" ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-accent-soft p-4 text-sm text-accent-soft-foreground">
            <Gift className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p>{card ? fill(tx.loyaltyHas, { stamps: Math.min(card.stamps, loyalty.goal), goal: loyalty.goal }) : fill(tx.loyaltyNew, { goal: loyalty.goal, reward: loyalty.reward })}</p>
              {card ? <a href={`/fidelite/${card.token}`} className="mt-1 inline-block font-medium underline underline-offset-2">{tx.seeCard}</a> : null}
            </div>
          </div>
        ) : null}
        <div className="mt-4 border-t border-border pt-4 text-sm">
          {mine ? (
            <>
              <p className="text-muted">{tx.inMySpace}</p>
              <Link href="/espace-client/commandes" className="mt-2 inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong px-4 font-medium hover:bg-surface-muted"><UserRound className="size-4" aria-hidden="true" />{tx.openSpace}</Link>
            </>
          ) : (
            <>
              <p className="font-medium">{tx.accountTitle}</p>
              <p className="mt-0.5 text-muted">{fill(tx.accountText, { email: o.email })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/inscription?client=1&suite=${suite}`} className="inline-flex h-11 items-center rounded-lg bg-accent px-4 font-medium text-accent-foreground hover:bg-accent-hover">{tx.createAccount}</a>
                <a href={`/connexion?suite=${suite}`} className="inline-flex h-11 items-center rounded-lg border border-border-strong px-4 font-medium hover:bg-surface-muted">{tx.signIn}</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

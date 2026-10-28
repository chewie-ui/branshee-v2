"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { saveShopSettings } from "@/server/actions/shop";

type S = { enabled: boolean; pickup: boolean; pickupNote: string; delivery: boolean; deliveryPrice: string; freeFrom: string; deliveryNote: string; payOnline: boolean; payOnPickup: boolean; payTransfer: boolean; intro: string };

export function ShopSettingsForm({ initial, stripeReady }: { initial: S; stripeReady: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const check = (k: keyof S, label: string, hint?: string, disabled?: boolean) => (
    <label className={cn("flex items-start gap-3", disabled && "opacity-60")}><input type="checkbox" checked={f[k] as boolean} disabled={disabled} onChange={(e) => setF({ ...f, [k]: e.target.checked })} className="mt-1 size-4" /><span><span className="font-medium">{label}</span>{hint ? <span className="block text-sm text-muted">{hint}</span> : null}</span></label>
  );
  return (
    <form className="max-w-2xl space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveShopSettings(f).catch(() => ({ ok: false as const, error: "Enregistrement impossible." })); setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Enregistré.") : r.error }); router.refresh(); }); }}>
      <Card className="space-y-4 p-5">
        {check("enabled", "Boutique ouverte", "Visible à l'adresse de votre boutique ; seuls les produits cochés « En vente sur la boutique » apparaissent.")}
        <Field label="Petit mot d'accueil (facultatif)" htmlFor="sh-intro"><Textarea id="sh-intro" rows={2} value={f.intro} onChange={(e) => setF({ ...f, intro: e.target.value })} maxLength={500} /></Field>
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Retrait et livraison</h2>
        {check("pickup", "Retrait sur place")}
        {f.pickup ? <Field label="Infos de retrait" htmlFor="sh-pn"><Input id="sh-pn" value={f.pickupNote} onChange={(e) => setF({ ...f, pickupNote: e.target.value })} maxLength={300} placeholder="Adresse, horaires…" /></Field> : null}
        {check("delivery", "Livraison")}
        {f.delivery ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Frais de livraison (€)" htmlFor="sh-dp"><Input id="sh-dp" inputMode="decimal" value={f.deliveryPrice} onChange={(e) => setF({ ...f, deliveryPrice: e.target.value })} /></Field>
            <Field label="Gratuite dès (€, facultatif)" htmlFor="sh-ff"><Input id="sh-ff" inputMode="decimal" value={f.freeFrom} onChange={(e) => setF({ ...f, freeFrom: e.target.value })} /></Field>
            <Field label="Zone et délais" htmlFor="sh-dn" className="sm:col-span-2"><Input id="sh-dn" value={f.deliveryNote} onChange={(e) => setF({ ...f, deliveryNote: e.target.value })} maxLength={300} placeholder="Ex. : Wavre et environs, sous 48 h" /></Field>
          </div>
        ) : null}
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Paiement</h2>
        {check("payOnline", "Carte et Bancontact en ligne", stripeReady ? "L'argent arrive sur votre compte Stripe." : undefined, !stripeReady)}
        {!stripeReady ? <p className="text-sm text-muted">Pour le paiement en ligne, connectez d&apos;abord votre compte Stripe dans <Link href="/app/reglages" className="font-medium text-accent hover:text-accent-hover">Réglages</Link>.</p> : null}
        {check("payOnPickup", "Paiement au retrait ou à la livraison")}
        {check("payTransfer", "Virement bancaire", "Votre IBAN (réglages de Factures) est affiché au client avec le n° de commande.")}
      </Card>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      <Button type="submit" loading={pending}>Enregistrer</Button>
    </form>
  );
}

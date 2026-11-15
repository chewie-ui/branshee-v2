"use client";

import { useState, useTransition } from "react";
import { Gift, QrCode, CalendarCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { describeRule, stampsForOrder, type ShopRule } from "@/lib/loyalty-rules";
import { TargetPicker } from "@/components/shop/shop-deals";
import { saveLoyaltySettings } from "@/server/actions/loyalty";
import { useT } from "@/components/app-locale";

type P = { id: string; name: string; category: string | null; priceCents: number };
type Init = { goal: number; reward: string; autoAppointment: boolean; autoShop: boolean; qrEnabled: boolean; shopRule: ShopRule };
const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
const toCents = (s: string) => { const n = Number(s.replace(",", ".").replace(/[^\d.]/g, "")); return Number.isFinite(n) ? Math.round(n * 100) : 0; };

/** Le programme de fidélité : combien de tampons, ce que le client obtient, et comment il gagne ses tampons. */
export function LoyaltyProgram({ initial, products, categories, hasShop, hasRdv }: { initial: Init; products: P[]; categories: string[]; hasShop: boolean; hasRdv: boolean }) {
  const t = useT();
  const [goal, setGoal] = useState(String(initial.goal));
  const [reward, setReward] = useState(initial.reward);
  const [qr, setQr] = useState(initial.qrEnabled);
  const [appt, setAppt] = useState(initial.autoAppointment);
  const [shop, setShop] = useState(initial.autoShop);
  const [rule, setRule] = useState<ShopRule>(initial.shopRule);
  const [minStr, setMinStr] = useState(initial.shopRule.minCents ? (initial.shopRule.minCents / 100).toFixed(2).replace(".", ",") : "");
  const [perStr, setPerStr] = useState((initial.shopRule.perCents / 100).toFixed(2).replace(".", ","));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<ShopRule>) => { setMsg(null); setRule((r) => ({ ...r, ...patch })); };
  const label = [...rule.target.categories, ...rule.target.products.map((id) => products.find((p) => p.id === id)?.name ?? "")].filter(Boolean).slice(0, 3).join(", ");
  // Exemple concret : le panier type (un article de chaque catégorie concernée, ou les 2 premiers produits).
  const sample = products.filter((p) => !rule.target.products.length && !rule.target.categories.length ? true : rule.target.products.includes(p.id) || (!!p.category && rule.target.categories.includes(p.category))).slice(0, 2);
  const goalN = Math.max(2, Math.min(50, Number(goal) || 10));

  const save = () => start(async () => {
    const r = await saveLoyaltySettings({ goal: goalN, reward, autoAppointment: appt, autoShop: shop, qrEnabled: qr, shopRule: { ...rule, minCents: toCents(minStr), perCents: Math.max(100, toCents(perStr)) } }).catch(() => ({ ok: false as const, error: t("Enregistrement impossible.") }));
    setMsg({ ok: r.ok, text: r.ok ? (r.message ?? t("Enregistré.")) : r.error });
  });

  const way = (on: boolean, setOn: (v: boolean) => void, Icon: typeof QrCode, title: string, hint: string, disabled = false) => (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4", on ? "border-accent bg-accent-soft/40" : "border-border", disabled && "cursor-not-allowed opacity-60")}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => { setMsg(null); setOn(e.target.checked); }} className="mt-1 size-4 accent-[var(--accent)]" />
      <Icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
      <span className="min-w-0"><span className="block font-medium">{title}</span><span className="block text-sm text-muted">{hint}</span></span>
    </label>
  );

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader title={t("La carte")} description={t("Combien de tampons pour la finir, et ce que le client obtient au bout.")} />
        <div className="grid gap-4 p-5 sm:grid-cols-[160px_1fr]">
          <Field label={t("Tampons pour finir la carte")} htmlFor="lp-goal"><Input id="lp-goal" inputMode="numeric" value={goal} onChange={(e) => { setMsg(null); setGoal(e.target.value.replace(/\D/g, "").slice(0, 2)); }} /></Field>
          <Field label={t("Ce que le client obtient")} htmlFor="lp-reward" hint={t("Ex. : un sandwich offert, un menu offert, −20 % sur la prochaine commande")}><Input id="lp-reward" value={reward} onChange={(e) => { setMsg(null); setReward(e.target.value); }} maxLength={120} /></Field>
          <p className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm sm:col-span-2"><Gift className="size-4 shrink-0 text-accent" aria-hidden="true" />{t("{n} tampons = {reward}", { n: goalN, reward: reward || "…" })}</p>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("Comment le client gagne des tampons")} description={t("Cochez autant de façons que vous voulez.")} />
        <div className="space-y-3 p-5">
          {way(qr, setQr, QrCode, t("En scannant votre QR code en caisse"), t("Un code qui change toutes les 30 secondes, à usage unique. Un tampon par jour et par client."))}
          {hasRdv ? way(appt, setAppt, CalendarCheck, t("Après chaque rendez-vous honoré"), t("Automatique, sauf si vous marquez une absence.")) : null}
          {way(shop, setShop, ShoppingBag, t("Avec les achats sur votre boutique en ligne"), hasShop ? t("Dès que la commande est payée en ligne ou retirée. La carte est créée au premier achat et son lien envoyé par email.") : t("Ajoutez l'app Boutique pour vendre en ligne."), !hasShop)}

          {shop && hasShop ? (
            <div className="space-y-4 rounded-xl border border-border bg-surface-muted/40 p-4">
              <p className="text-sm font-medium">{t("Règle pour les achats en ligne")}</p>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t("Règle pour les achats en ligne")}>
                {([["order", "Par commande"], ["item", "Par article"], ["amount", "Par montant"]] as const).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={rule.mode === k} onClick={() => set({ mode: k })} className={cn("h-11 rounded-lg border text-sm font-medium", rule.mode === k ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border bg-surface hover:bg-surface-muted")}>{t(l)}</button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {rule.mode === "order" ? (
                  <>
                    <Field label={t("Tampons par commande")} htmlFor="lp-per"><Input id="lp-per" type="number" min={1} max={10} value={rule.perOrder} onChange={(e) => set({ perOrder: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} /></Field>
                    <Field label={t("Commande minimum (€, facultatif)")} htmlFor="lp-min" hint={t("En produits concernés")}><Input id="lp-min" inputMode="decimal" value={minStr} onChange={(e) => { setMsg(null); setMinStr(e.target.value); }} placeholder="0,00" /></Field>
                  </>
                ) : rule.mode === "item" ? (
                  <Field label={t("Prix minimum de l'article (€, facultatif)")} htmlFor="lp-min" hint={t("Ex. 5 € : seuls les sandwichs à 5 € ou plus comptent")}><Input id="lp-min" inputMode="decimal" value={minStr} onChange={(e) => { setMsg(null); setMinStr(e.target.value); }} placeholder="0,00" /></Field>
                ) : (
                  <Field label={t("1 tampon tous les (€)")} htmlFor="lp-pc"><Input id="lp-pc" inputMode="decimal" value={perStr} onChange={(e) => { setMsg(null); setPerStr(e.target.value); }} /></Field>
                )}
                <Field label={t("Maximum par commande (facultatif)")} htmlFor="lp-max" hint={t("Vide = sans limite")}><Input id="lp-max" type="number" min={1} max={50} value={rule.maxPerOrder ?? ""} onChange={(e) => set({ maxPerOrder: e.target.value ? Math.max(1, Math.min(50, Number(e.target.value))) : null })} /></Field>
              </div>
              <div>
                <p className="text-sm font-medium">{t("Produits qui comptent")}</p>
                <p className="text-xs text-muted">{t("Ex. : seulement la catégorie Sandwichs, ou un sandwich précis. Rien de choisi = tous les produits.")}</p>
                <TargetPicker value={rule.target} onChange={(v) => set({ target: v })} products={products} categories={categories} />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rule.menus} onChange={(e) => set({ menus: e.target.checked })} className="size-4" />{t("Les menus comptent aussi")}</label>
              <p className="rounded-lg bg-surface px-3 py-2 text-sm"><span className="font-medium">{describeRule({ ...rule, minCents: toCents(minStr), perCents: Math.max(100, toCents(perStr)) }, eur, label)}</span>{sample.length ? <span className="block text-muted">{t("Exemple : {items} → {n} tampon(s)", { items: sample.map((p) => p.name).join(" + "), n: stampsForOrder({ ...rule, minCents: toCents(minStr), perCents: Math.max(100, toCents(perStr)) }, sample.map((p) => ({ productId: p.id, category: p.category, unitCents: p.priceCents, qty: 1 }))) })}</span> : null}</p>
            </div>
          ) : null}
        </div>
      </Card>

      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{t(msg.text)}</p> : null}
      <div className="sticky bottom-0 z-10 -mx-1 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
        <Button type="button" loading={pending} onClick={save}>{t("Enregistrer")}</Button>
      </div>
    </div>
  );
}

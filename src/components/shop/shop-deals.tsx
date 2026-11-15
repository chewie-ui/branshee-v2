"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Plus, Search, Tag, Trash2, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { newDealId, type Deal, type DealTarget } from "@/lib/deals";
import { saveShopDeals } from "@/server/actions/shop";
import { useT } from "@/components/app-locale";

type P = { id: string; name: string; category: string | null; priceCents: number };
const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
const toCents = (s: string) => { const n = Number(s.replace(",", ".").replace(/[^\d.]/g, "")); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
const empty = (): DealTarget => ({ products: [], categories: [] });

/** Modèles : les cas courants en un clic, tout reste modifiable. */
const TEMPLATES: { label: string; icon: typeof Tag; make: () => Deal }[] = [
  { label: "1 acheté = 1 offert", icon: Tag, make: () => ({ id: newDealId(), kind: "buyget", name: "1 acheté = 1 offert", active: true, startsOn: null, endsOn: null, buyQty: 1, buy: empty(), getQty: 1, get: empty(), percent: 100, maxPerOrder: null }) },
  { label: "−50 % sur un autre produit", icon: Tag, make: () => ({ id: newDealId(), kind: "buyget", name: "−50 % sur le 2e produit", active: true, startsOn: null, endsOn: null, buyQty: 1, buy: empty(), getQty: 1, get: empty(), percent: 50, maxPerOrder: null }) },
  { label: "Le 4e offert", icon: Tag, make: () => ({ id: newDealId(), kind: "buyget", name: "3 achetés, le 4e offert", active: true, startsOn: null, endsOn: null, buyQty: 3, buy: empty(), getQty: 1, get: empty(), percent: 100, maxPerOrder: null }) },
  { label: "Menu / formule", icon: UtensilsCrossed, make: () => ({ id: newDealId(), kind: "menu", name: "Menu midi", active: true, startsOn: null, endsOn: null, description: "", priceCents: 850, vatRate: 6, slots: [{ id: newDealId(), label: "Sandwich", target: empty() }, { id: newDealId(), label: "Boisson", target: empty() }, { id: newDealId(), label: "Dessert", target: empty() }] }) },
];

/** Promos (« 1 acheté = 1 offert », « −50 % sur… ») et menus à prix fixe de la boutique — entièrement modulables. */
export function ShopDeals({ initial, products, categories }: { initial: Deal[]; products: P[]; categories: string[] }) {
  const t = useT();
  const [deals, setDeals] = useState<Deal[]>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(deals) !== saved;
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const set = (id: string, patch: Partial<Deal>) => { setMsg(null); setDeals((ds) => ds.map((d) => (d.id === id ? ({ ...d, ...patch } as Deal) : d))); };
  const describe = (tg: DealTarget) => (!tg.products.length && !tg.categories.length ? t("toute la boutique") : [...tg.categories, ...tg.products.map((id) => byId.get(id)?.name ?? "?")].slice(0, 4).join(", ") + (tg.categories.length + tg.products.length > 4 ? "…" : ""));
  const summary = (d: Deal) => (d.kind === "menu" ? `${eur(d.priceCents)} · ${d.slots.map((s) => s.label).join(" + ")}` : `${d.buyQty} × ${describe(d.buy)} → ${d.getQty} × ${describe(d.get)} ${d.percent === 100 ? t("offert") : `−${d.percent} %`}`);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <p className="text-sm font-medium">{t("Ajouter")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TEMPLATES.map((tp) => (
            <button key={tp.label} type="button" onClick={() => { const d = tp.make(); setDeals((ds) => [d, ...ds]); setOpen(d.id); setMsg(null); }} className="inline-flex h-10 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted">
              <Plus className="size-4" aria-hidden="true" /><tp.icon className="size-4 text-accent" aria-hidden="true" />{t(tp.label)}
            </button>
          ))}
        </div>
      </div>

      {deals.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">
          <Tag className="mx-auto mb-2 size-8" aria-hidden="true" />
          {t("Aucune promo pour l'instant. Choisissez un modèle ci-dessus : « 1 acheté = 1 offert », « −50 % sur un autre produit », ou un menu à prix fixe.")}
        </Card>
      ) : null}

      <ul className="space-y-3">
        {deals.map((d) => {
          const isOpen = open === d.id;
          return (
            <li key={d.id}>
              <Card className={cn(!d.active && "opacity-70")}>
                <div className="flex items-center gap-3 px-5 py-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent" aria-hidden="true">{d.kind === "menu" ? <UtensilsCrossed className="size-4" /> : <Tag className="size-4" />}</span>
                  <button type="button" onClick={() => setOpen(isOpen ? null : d.id)} className="min-w-0 flex-1 text-left" aria-expanded={isOpen}>
                    <span className="block truncate font-medium">{d.name || t("Sans nom")}</span>
                    <span className="block truncate text-sm text-muted">{summary(d)}</span>
                  </button>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" role="switch" checked={d.active} onChange={(e) => set(d.id, { active: e.target.checked })} className="size-4 accent-[var(--accent)]" />{d.active ? t("Active") : t("En pause")}</label>
                  <button type="button" onClick={() => setOpen(isOpen ? null : d.id)} className="flex size-9 items-center justify-center rounded-lg hover:bg-surface-muted" aria-label={isOpen ? t("Replier") : t("Modifier")}><ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} aria-hidden="true" /></button>
                </div>
                {isOpen ? (
                  <div className="space-y-5 border-t border-border p-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label={t("Nom affiché aux clients")} htmlFor={`n-${d.id}`} className="sm:col-span-3"><Input id={`n-${d.id}`} value={d.name} onChange={(e) => set(d.id, { name: e.target.value })} maxLength={80} /></Field>
                      <Field label={t("Du (facultatif)")} htmlFor={`s-${d.id}`}><Input id={`s-${d.id}`} type="date" value={d.startsOn ?? ""} onChange={(e) => set(d.id, { startsOn: e.target.value || null })} /></Field>
                      <Field label={t("Au (facultatif)")} htmlFor={`e-${d.id}`}><Input id={`e-${d.id}`} type="date" value={d.endsOn ?? ""} onChange={(e) => set(d.id, { endsOn: e.target.value || null })} /></Field>
                    </div>

                    {d.kind === "buyget" ? (
                      <>
                        <fieldset className="rounded-xl border border-border p-4">
                          <legend className="px-1 text-sm font-medium">{t("Quand le client achète")}</legend>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Input aria-label={t("Quantité achetée")} type="number" min={1} max={20} value={d.buyQty} onChange={(e) => set(d.id, { buyQty: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className="w-20" />
                            <span>{t("article(s) parmi")}</span>
                          </div>
                          <TargetPicker value={d.buy} onChange={(v) => set(d.id, { buy: v })} products={products} categories={categories} />
                        </fieldset>
                        <fieldset className="rounded-xl border border-border p-4">
                          <legend className="px-1 text-sm font-medium">{t("Il obtient")}</legend>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Input aria-label={t("Quantité remisée")} type="number" min={1} max={20} value={d.getQty} onChange={(e) => set(d.id, { getQty: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className="w-20" />
                            <span>{t("article(s)")}</span>
                            <Select aria-label={t("Remise")} value={String(d.percent)} onChange={(e) => set(d.id, { percent: Number(e.target.value) })} className="w-auto">
                              <option value="100">{t("offert(s)")}</option>
                              {[10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90].map((p) => <option key={p} value={p}>−{p} %</option>)}
                            </Select>
                            <span>{t("parmi")}</span>
                          </div>
                          <TargetPicker value={d.get} onChange={(v) => set(d.id, { get: v })} products={products} categories={categories} />
                          <p className="mt-3 text-xs text-muted">{t("Le moins cher des articles concernés est remisé. Même liste des deux côtés = « 1 acheté = 1 offert » sur ces produits.")}</p>
                        </fieldset>
                        <Field label={t("Maximum par commande (facultatif)")} htmlFor={`m-${d.id}`} hint={t("Vide = sans limite")}><Input id={`m-${d.id}`} type="number" min={1} max={50} value={d.maxPerOrder ?? ""} onChange={(e) => set(d.id, { maxPerOrder: e.target.value ? Math.max(1, Math.min(50, Number(e.target.value))) : null })} className="w-28" /></Field>
                      </>
                    ) : (
                      <>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Field label={t("Prix du menu (€ TVAC)")} htmlFor={`p-${d.id}`}><Input id={`p-${d.id}`} inputMode="decimal" defaultValue={(d.priceCents / 100).toFixed(2).replace(".", ",")} onBlur={(e) => set(d.id, { priceCents: toCents(e.target.value) })} /></Field>
                          <Field label={t("TVA")} htmlFor={`v-${d.id}`}><Select id={`v-${d.id}`} value={String(d.vatRate)} onChange={(e) => set(d.id, { vatRate: Number(e.target.value) })}>{[6, 12, 21, 0].map((v) => <option key={v} value={v}>{v} %</option>)}</Select></Field>
                          <Field label={t("Description (facultatif)")} htmlFor={`d-${d.id}`} className="sm:col-span-3"><Input id={`d-${d.id}`} value={d.description} onChange={(e) => set(d.id, { description: e.target.value })} maxLength={300} placeholder={t("Ex. : servi de 11 h 30 à 14 h")} /></Field>
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm font-medium">{t("Ce que le client choisit")}</p>
                          {d.slots.map((slot, i) => (
                            <div key={slot.id} className="rounded-xl border border-border p-4">
                              <div className="flex items-center gap-2">
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold">{i + 1}</span>
                                <Input aria-label={t("Nom de l'élément")} value={slot.label} onChange={(e) => set(d.id, { slots: d.slots.map((x) => (x.id === slot.id ? { ...x, label: e.target.value } : x)) })} maxLength={40} placeholder={t("Ex. : Boisson")} />
                                <button type="button" disabled={d.slots.length <= 2} onClick={() => set(d.id, { slots: d.slots.filter((x) => x.id !== slot.id) })} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:text-danger disabled:opacity-30" aria-label={t("Retirer cet élément")}><Trash2 className="size-4" aria-hidden="true" /></button>
                              </div>
                              <TargetPicker value={slot.target} onChange={(v) => set(d.id, { slots: d.slots.map((x) => (x.id === slot.id ? { ...x, target: v } : x)) })} products={products} categories={categories} />
                            </div>
                          ))}
                          {d.slots.length < 8 ? <button type="button" onClick={() => set(d.id, { slots: [...d.slots, { id: newDealId(), label: "", target: empty() }] })} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"><Plus className="size-4" aria-hidden="true" />{t("Ajouter un élément")}</button> : null}
                          <MenuSaving deal={d} products={products} />
                        </div>
                      </>
                    )}
                    <div className="flex justify-end border-t border-border pt-4">
                      <button type="button" onClick={() => { setDeals((ds) => ds.filter((x) => x.id !== d.id)); setMsg(null); }} className="inline-flex items-center gap-1 text-sm font-medium text-danger"><Trash2 className="size-4" aria-hidden="true" />{t("Supprimer cette offre")}</button>
                    </div>
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>

      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{t(msg.text)}</p> : null}
      <div className="sticky bottom-0 z-10 -mx-1 flex gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
        <Button type="button" loading={pending} disabled={!dirty} onClick={() => start(async () => { const r = await saveShopDeals(deals).catch(() => ({ ok: false as const, error: t("Enregistrement impossible.") })); if (r.ok) setSaved(JSON.stringify(deals)); setMsg({ ok: r.ok, text: r.ok ? (r.message ?? t("Enregistré.")) : r.error }); })}>{t("Enregistrer")}</Button>
        {dirty ? <Button type="button" variant="secondary" onClick={() => { setDeals(JSON.parse(saved)); setMsg(null); }}>{t("Annuler")}</Button> : null}
      </div>
    </div>
  );
}

/** Ce que le menu fait économiser (prix des choix les plus chers vs prix du menu), pour aider à fixer le prix. */
function MenuSaving({ deal, products }: { deal: Extract<Deal, { kind: "menu" }>; products: P[] }) {
  const t = useT();
  const prices = deal.slots.map((s) => {
    const ok = products.filter((p) => (!s.target.products.length && !s.target.categories.length) || s.target.products.includes(p.id) || (!!p.category && s.target.categories.includes(p.category)));
    return ok.length ? { min: Math.min(...ok.map((p) => p.priceCents)), max: Math.max(...ok.map((p) => p.priceCents)), n: ok.length } : null;
  });
  if (prices.some((p) => !p)) return <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">{t("Un élément du menu n'a aucun produit : choisissez au moins un produit ou une catégorie.")}</p>;
  const min = prices.reduce((a, p) => a + p!.min, 0);
  const max = prices.reduce((a, p) => a + p!.max, 0);
  return <p className="text-sm text-muted">{t("Achetés séparément : {min} à {max}. Le client paie {price}.", { min: eur(min), max: eur(max), price: eur(deal.priceCents) })}</p>;
}

/** Choix des produits concernés : des catégories entières et/ou des produits précis (rien = toute la boutique). */
function TargetPicker({ value, onChange, products, categories }: { value: DealTarget; onChange: (v: DealTarget) => void; products: P[]; categories: string[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const toggle = <K extends keyof DealTarget>(k: K, v: string) => onChange({ ...value, [k]: value[k].includes(v) ? value[k].filter((x) => x !== v) : [...value[k], v] });
  const shown = products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 80);
  const count = value.products.length + value.categories.length;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {count === 0 ? <span className="rounded-full bg-surface-muted px-3 py-1 text-sm">{t("Toute la boutique")}</span> : null}
        {value.categories.map((c) => <button key={c} type="button" onClick={() => toggle("categories", c)} className="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent-soft-foreground" aria-label={t("Retirer {x}", { x: c })}>{c} ×</button>)}
        {value.products.map((id) => { const p = products.find((x) => x.id === id); return <button key={id} type="button" onClick={() => toggle("products", id)} className="rounded-full border border-border px-3 py-1 text-sm" aria-label={t("Retirer {x}", { x: p?.name ?? "" })}>{p?.name ?? "?"} ×</button>; })}
        <button type="button" onClick={() => setOpen(!open)} className="text-sm font-medium text-accent hover:text-accent-hover" aria-expanded={open}>{open ? t("Fermer") : t("Choisir les produits")}</button>
      </div>
      {open ? (
        <div className="mt-3 space-y-3 rounded-lg bg-surface-muted/60 p-3">
          {categories.length ? (
            <div>
              <p className="text-xs font-medium text-muted">{t("Catégories entières (les nouveaux produits suivent)")}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {categories.map((c) => <label key={c} className={cn("flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm", value.categories.includes(c) ? "border-accent bg-accent-soft" : "border-border bg-surface")}><input type="checkbox" checked={value.categories.includes(c)} onChange={() => toggle("categories", c)} className="size-4" />{c}</label>)}
              </div>
            </div>
          ) : null}
          <div>
            <p className="text-xs font-medium text-muted">{t("Produits précis")}</p>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Rechercher un produit")} aria-label={t("Rechercher un produit")} className="pl-9" />
            </div>
            <ul className="mt-2 max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-surface">
              {shown.map((p) => (
                <li key={p.id}><label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm"><input type="checkbox" checked={value.products.includes(p.id)} onChange={() => toggle("products", p.id)} className="size-4" /><span className="flex-1">{p.name}{p.category ? <span className="text-muted"> · {p.category}</span> : null}</span><span className="text-muted tabular-nums">{eur(p.priceCents)}</span></label></li>
              ))}
              {shown.length === 0 ? <li className="px-3 py-3 text-sm text-muted">{t("Aucun produit en vente en ligne.")}</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

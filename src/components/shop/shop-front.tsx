"use client";

import { sizeHint } from "@/lib/sizes";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Minus, Package, Plus, ShoppingBag, Store, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { MAX_SHOP_QTY, deliveryFee } from "@/lib/shop";
import { placeShopOrder } from "@/server/actions/shop-order";
import { fill, type PublicTexts } from "@/i18n/public-pages";
import { priceSelection, type OptionGroup } from "@/lib/product-options";

type Item = { id: string; name: string; description: string | null; category: string | null; priceCents: number; regularCents?: number | null; options?: OptionGroup[]; photoUrl: string | null; trackStock: boolean; stockQty: number; isModel?: boolean; parentId?: string | null; size?: string | null; color?: string | null; sizeGrid?: string | null };
type Settings = { intro: string | null; pickup: boolean; pickupNote: string | null; delivery: boolean; deliveryCents: number; freeDeliveryFromCents: number | null; deliveryNote: string | null; payOnline: boolean; payOnPickup: boolean; payTransfer: boolean };
type Seller = { iban: string; legalName: string; street: string; zip: string; city: string; vat: string; bce: string; email: string } | null;
const input = "h-11 w-full rounded-lg border border-border bg-surface px-3";

/** Vitrine, panier et commande (sans compte). */
export function ShopFront({ look, slug, business, settings: s, items, seller, tx, intl }: { slug: string; business: { name: string; photoUrl: string | null; city: string | null }; settings: Settings; items: Item[]; seller: Seller; tx: PublicTexts["shop"]; intl: string; look?: { vars: Record<string, string>; layout: "grid" | "list"; bannerUrl: string | null; title: string | null } }) {
  const eur = (c: number) => new Intl.NumberFormat(intl, { style: "currency", currency: "EUR" }).format(c / 100);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cat, setCat] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", address: "", note: "", pickupAt: "", fulfilment: s.pickup ? "pickup" : "delivery", payMethod: s.payOnline ? "online" : s.payOnPickup ? "pickup" : "transfer", terms: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = `sky-shop-${slug}`;
  useEffect(() => { try { const raw = localStorage.getItem(key); if (raw) setCart(JSON.parse(raw)); } catch {} }, [key]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(cart)); } catch {} }, [cart, key]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  // Panier : une ligne par produit + options (clé « id|choix1,choix2 ») ; prix recalculé par le serveur à la commande.
  const parse = (key: string) => { const [id, ch] = key.split("|"); return { id: id!, choices: ch ? ch.split(",").filter(Boolean) : [] }; };
  const lineOf = (key: string) => { const { id, choices } = parse(key); const it = byId.get(id); if (!it) return null; const sel = priceSelection(it.options ?? [], choices); if (!sel) return null; return { it, choices, unit: it.priceCents + sel.extraCents, label: sel.label }; };
  const lines = Object.entries(cart).filter(([k, q]) => q > 0 && lineOf(k));
  const itemsCents = lines.reduce((a, [k, q]) => a + lineOf(k)!.unit * q, 0);
  const qtyOf = (id: string) => Object.entries(cart).reduce((a, [k, q]) => a + (parse(k).id === id ? q : 0), 0);
  const [opt, setOpt] = useState<Item | null>(null);
  const fee = f.fulfilment === "delivery" ? deliveryFee(itemsCents, s) : 0;
  const count = lines.reduce((a, [, q]) => a + q, 0);
  const max = (it: Item) => (it.trackStock ? Math.min(MAX_SHOP_QTY, it.stockQty) : MAX_SHOP_QTY);
  const addKey = (key: string, d: number) => { const it = byId.get(parse(key).id); if (!it) return; setCart((c) => { const cur = c[key] ?? 0; const room = max(it) - (qtyOf(it.id) - cur); return { ...c, [key]: Math.max(0, Math.min(room, cur + d)) }; }); };
  const add = (it: Item, d: number) => addKey(it.id, d);
  const cats = [...new Set(items.map((i) => i.category).filter((x): x is string => !!x))];
  // Tailles et couleurs : une seule carte par modèle, la déclinaison se choisit dans la carte.
  const variantsOf = (id: string) => items.filter((v) => v.parentId === id);
  const [pick, setPick] = useState<Record<string, string>>({});
  const shown = items.filter((i) => !i.parentId && (!i.isModel || variantsOf(i.id).length) && (!cat || i.category === cat));
  const payLabel = { online: tx.payOnline, pickup: f.fulfilment === "delivery" ? tx.payOnDelivery : tx.payOnPickup, transfer: tx.payTransfer };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const r = await placeShopOrder({ slug, lines: lines.map(([k, qty]) => ({ productId: parse(k).id, qty, choices: parse(k).choices })), fulfilment: f.fulfilment as "pickup" | "delivery", payMethod: f.payMethod as "online" | "pickup" | "transfer", name: f.name, email: f.email, phone: f.phone, address: f.address, note: f.note, pickupAt: f.fulfilment === "pickup" ? f.pickupAt : "", terms: f.terms as true }).catch(() => ({ ok: false as const, error: tx.sendError }));
      if (!r.ok) return setError(r.error);
      try { localStorage.removeItem(key); } catch {}
      window.location.href = r.url;
    });
  };

  return (
    <div className="min-h-dvh bg-background pb-28 font-sans text-text" style={look?.vars as React.CSSProperties}>
      {look?.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={look.bannerUrl} alt="" className="h-40 w-full object-cover sm:h-56" />
      ) : null}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
          {business.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.photoUrl} alt="" className="size-14 rounded-xl object-cover" />
          ) : <span className="flex size-14 items-center justify-center rounded-xl bg-accent-soft text-accent" aria-hidden="true"><Store className="size-7" /></span>}
          <div className="min-w-0"><h1 className="truncate text-xl font-semibold">{look?.title || business.name}</h1><p className="text-sm text-muted">{tx.online}{business.city ? ` · ${business.city}` : ""}</p></div>
        </div>
        {s.intro ? <p className="mx-auto max-w-5xl px-4 pb-4 text-sm text-muted">{s.intro}</p> : null}
      </header>
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {cats.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={tx.categories}>
            <button type="button" aria-pressed={!cat} onClick={() => setCat(null)} className={cn("h-9 shrink-0 rounded-full border px-3 text-sm", !cat ? "border-accent bg-accent-soft font-medium text-accent" : "border-border")}>{tx.all}</button>
            {cats.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={cn("h-9 shrink-0 rounded-full border px-3 text-sm", cat === c ? "border-accent bg-accent-soft font-medium text-accent" : "border-border")}>{c}</button>)}
          </div>
        ) : null}
        {items.length === 0 ? <p className="py-16 text-center text-muted">{tx.empty}</p> : (
          <ul className={look?.layout === "list" ? "grid gap-3 sm:grid-cols-2" : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"}>
            {shown.map((card) => {
              const vars = card.isModel ? variantsOf(card.id) : [];
              const avail = vars.filter((v) => !v.trackStock || v.stockQty > 0);
              const it = card.isModel ? (vars.find((v) => v.id === pick[card.id]) ?? avail[0] ?? vars[0]!) : card;
              const q = cart[it.id] ?? 0;
              const hasOpts = (it.options ?? []).length > 0;
              const fromCents = it.priceCents + (it.options ?? []).filter((g) => g.required).reduce((a, g) => a + (g.multi ? 0 : Math.min(...g.choices.map((c) => c.priceCents))), 0);
              const out = it.trackStock && it.stockQty <= 0;
              return (
                <li key={card.id} className={cn("relative flex overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--card-shadow)]", look?.layout === "list" ? "flex-row" : "flex-col")}>
                  {it.regularCents ? <span className="absolute top-2 left-2 z-10 rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-white">{tx.promo} −{Math.round((1 - it.priceCents / it.regularCents) * 100)} %</span> : null}
                  {it.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.photoUrl} alt="" className={look?.layout === "list" ? "size-28 shrink-0 object-cover sm:size-32" : "aspect-square w-full object-cover"} loading="lazy" />
                  ) : <span className={cn("flex items-center justify-center bg-surface-muted text-muted", look?.layout === "list" ? "size-28 shrink-0 sm:size-32" : "aspect-square")} aria-hidden="true"><Package className="size-10" /></span>}
                  <div className="flex min-w-0 flex-1 flex-col p-3">
                    <p className="font-medium">{card.name}</p>
                    {card.isModel ? (
                      <select aria-label={`${tx.option} : ${card.name}`} value={it.id} onChange={(e) => setPick((p) => ({ ...p, [card.id]: e.target.value }))} className="mt-2 h-10 w-full rounded-lg border border-border-strong bg-surface px-2 text-sm">
                        {vars.map((v) => (
                          <option key={v.id} value={v.id} disabled={v.trackStock && v.stockQty <= 0}>
                            {[v.size, v.color].filter(Boolean).join(" / ")}{v.size && sizeHint(v.sizeGrid, v.size) ? ` (${sizeHint(v.sizeGrid, v.size)})` : ""}{v.trackStock && v.stockQty <= 0 ? ` · ${tx.soldOut}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {it.description ? <p className="mt-0.5 line-clamp-3 text-sm text-muted">{it.description}</p> : null}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                      <span className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className={cn("font-semibold tabular-nums", it.regularCents ? "text-danger" : "")}>{hasOpts && fromCents !== it.priceCents ? fill(tx.fromPrice, { price: eur(fromCents) }) : eur(it.priceCents)}</span>
                        {it.regularCents ? <s className="text-sm text-muted tabular-nums">{eur(it.regularCents)}</s> : null}
                      </span>
                      {out ? <span className="text-xs font-medium text-danger">{tx.soldOut}</span> : hasOpts ? (
                        <button type="button" onClick={() => setOpt(it)} className="inline-flex h-10 items-center gap-1 rounded-full bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover" aria-label={`${tx.choose} : ${it.name}`}><Plus className="size-4" aria-hidden="true" />{tx.choose}{qtyOf(it.id) ? ` (${qtyOf(it.id)})` : ""}</button>
                      ) : q ? (
                        <span className="inline-flex items-center rounded-full border border-border-strong">
                          <button type="button" onClick={() => add(it, -1)} className="flex size-10 items-center justify-center" aria-label={fill(tx.lessAria, { name: it.name })}><Minus className="size-4" aria-hidden="true" /></button>
                          <span className="w-5 text-center text-sm font-semibold tabular-nums">{q}</span>
                          <button type="button" onClick={() => add(it, 1)} disabled={q >= max(it)} className="flex size-10 items-center justify-center disabled:opacity-30" aria-label={fill(tx.moreAria, { name: it.name })}><Plus className="size-4" aria-hidden="true" /></button>
                        </span>
                      ) : <button type="button" onClick={() => add(it, 1)} className="inline-flex h-10 items-center gap-1 rounded-full bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover" aria-label={fill(tx.addAria, { name: it.name })}><Plus className="size-4" aria-hidden="true" />{tx.add}</button>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {seller ? (
          <footer className="border-t border-border pt-6 text-xs text-muted">
            <p>{seller.legalName || business.name}{seller.street ? ` · ${seller.street}, ${seller.zip} ${seller.city}` : ""}{seller.bce ? ` · ${tx.bce} ${seller.bce}` : ""}{seller.vat ? ` · ${tx.vat} ${seller.vat}` : ""}{seller.email ? ` · ${seller.email}` : ""}</p>
            <p className="mt-1">{tx.vatIncl}</p>
          </footer>
        ) : null}
      </main>

      {count ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 p-3 backdrop-blur">
          <button type="button" onClick={() => setOpen(true)} className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between rounded-xl bg-accent px-5 font-semibold text-accent-foreground hover:bg-accent-hover">
            <span className="flex items-center gap-2"><ShoppingBag className="size-5" aria-hidden="true" />{fill(tx.cart, { n: count })}</span><span className="tabular-nums">{eur(itemsCents)}</span>
          </button>
        </div>
      ) : null}

      {opt ? <OptionsDialog item={opt} eur={eur} tx={tx} room={max(opt) - qtyOf(opt.id)} onClose={() => setOpt(null)} onAdd={(choices, n) => { addKey(choices.length ? `${opt.id}|${[...choices].sort().join(",")}` : opt.id, n); setOpt(null); }} /> : null}

      {open ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="cart-h">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label={tx.close} tabIndex={-1} onClick={() => setOpen(false)} />
          <form onSubmit={submit} className="relative max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl" noValidate>
            <div className="flex items-center justify-between"><h2 id="cart-h" className="text-lg font-semibold">{tx.yourOrder}</h2><button type="button" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label={tx.close}><X className="size-5" aria-hidden="true" /></button></div>
            <ul className="mt-2 divide-y divide-border text-sm">
              {lines.map(([k, q]) => { const l = lineOf(k)!; return (
                <li key={k} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1"><span className="block">{q} × {l.it.name}</span>{l.label ? <span className="block text-xs text-muted">{l.label}</span> : null}</span>
                  <span className="inline-flex items-center rounded-full border border-border">
                    <button type="button" onClick={() => addKey(k, -1)} className="flex size-9 items-center justify-center" aria-label={fill(tx.lessAria, { name: l.it.name })}><Minus className="size-3.5" aria-hidden="true" /></button>
                    <button type="button" onClick={() => addKey(k, 1)} disabled={qtyOf(l.it.id) >= max(l.it)} className="flex size-9 items-center justify-center disabled:opacity-30" aria-label={fill(tx.moreAria, { name: l.it.name })}><Plus className="size-3.5" aria-hidden="true" /></button>
                  </span>
                  <span className="w-16 text-right tabular-nums">{eur(q * l.unit)}</span>
                </li>
              ); })}
            </ul>
            <fieldset className="mt-4 space-y-2">
              <legend className="text-sm font-medium">{tx.howGet}</legend>
              {s.pickup ? <label className="flex items-start gap-2 text-sm"><input type="radio" name="ful" checked={f.fulfilment === "pickup"} onChange={() => setF({ ...f, fulfilment: "pickup" })} className="mt-0.5 size-4" /><span>{tx.pickupFree}{s.pickupNote ? <span className="block text-muted">{s.pickupNote}</span> : null}</span></label> : null}
              {s.delivery ? <label className="flex items-start gap-2 text-sm"><input type="radio" name="ful" checked={f.fulfilment === "delivery"} onChange={() => setF({ ...f, fulfilment: "delivery" })} className="mt-0.5 size-4" /><span>{fill(tx.delivery, { fee: deliveryFee(itemsCents, s) ? eur(deliveryFee(itemsCents, s)) : tx.free })}{s.deliveryNote ? <span className="block text-muted">{s.deliveryNote}</span> : null}</span></label> : null}
            </fieldset>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="so-name" className="text-sm font-medium">{tx.name}</label><input id="so-name" className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" maxLength={120} /></div>
              <div><label htmlFor="so-phone" className="text-sm font-medium">{tx.phone}</label><input id="so-phone" className={input} type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" maxLength={40} /></div>
              <div className="sm:col-span-2"><label htmlFor="so-email" className="text-sm font-medium">{tx.email}</label><input id="so-email" className={input} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" maxLength={200} /></div>
              {f.fulfilment === "delivery" ? <div className="sm:col-span-2"><label htmlFor="so-addr" className="text-sm font-medium">{tx.address}</label><input id="so-addr" className={input} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} autoComplete="street-address" maxLength={300} /></div> : null}
              {f.fulfilment === "pickup" ? <div className="sm:col-span-2"><label htmlFor="so-when" className="text-sm font-medium">{tx.pickupWhen}</label><select id="so-when" className={input} value={f.pickupAt} onChange={(e) => setF({ ...f, pickupAt: e.target.value })}><option value="">{tx.asap}</option>{pickupTimes().map((t) => <option key={t} value={t}>{t}</option>)}</select></div> : null}
              <div className="sm:col-span-2"><label htmlFor="so-note" className="text-sm font-medium">{tx.note}</label><input id="so-note" className={input} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} /></div>
            </div>
            <fieldset className="mt-4 space-y-2">
              <legend className="text-sm font-medium">{tx.payment}</legend>
              {(["online", "pickup", "transfer"] as const).filter((k) => (k === "online" ? s.payOnline : k === "pickup" ? s.payOnPickup : s.payTransfer)).map((k) => <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="pay" checked={f.payMethod === k} onChange={() => setF({ ...f, payMethod: k })} className="size-4" />{payLabel[k]}</label>)}
            </fieldset>
            <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} className="mt-0.5 size-4" /><span>{tx.terms}</span></label>
            {error ? <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
            <button type="submit" disabled={pending} className="mt-4 flex h-14 w-full items-center justify-between rounded-xl bg-accent px-5 font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-60"><span>{pending ? tx.sending : f.payMethod === "online" ? tx.orderPay : tx.order}</span><span className="tabular-nums">{eur(itemsCents + fee)}</span></button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

/** Heures de retrait proposées : par quart d'heure, de dans 15 minutes jusqu'à 22 h (aujourd'hui). */
function pickupTimes() {
  const out: string[] = [];
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil((d.getMinutes() + 15) / 15) * 15);
  while (d.getHours() < 22 && d.getDate() === new Date().getDate() && out.length < 48) {
    out.push(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    d.setMinutes(d.getMinutes() + 15);
  }
  return out;
}

/** Choix des options d'un produit (pain, garnitures, retirer, suppléments) : le prix se met à jour en direct. */
function OptionsDialog({ item, eur, tx, room, onClose, onAdd }: { item: Item; eur: (c: number) => string; tx: PublicTexts["shop"]; room: number; onClose: () => void; onAdd: (choices: string[], qty: number) => void }) {
  const groups = item.options ?? [];
  const [picked, setPicked] = useState<string[]>(() => groups.filter((g) => g.required && !g.multi && g.choices.length === 1).map((g) => g.choices[0]!.id));
  const [n, setN] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const sel = priceSelection(groups, picked);
  const unit = item.priceCents + groups.flatMap((g) => g.choices).filter((c) => picked.includes(c.id)).reduce((a, c) => a + c.priceCents, 0);
  const toggle = (g: OptionGroup, id: string) => {
    setErr(null);
    setPicked((p) => {
      if (!g.multi) return [...p.filter((x) => !g.choices.some((c) => c.id === x)), id];
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (g.max && g.choices.filter((c) => p.includes(c.id)).length >= g.max) return p;
      return [...p, id];
    });
  };
  const confirm = () => {
    const missing = groups.find((g) => g.required && !g.choices.some((c) => picked.includes(c.id)));
    if (missing) return setErr(fill(tx.missingChoice, { name: missing.name }));
    if (!sel) return;
    onAdd(picked, Math.max(1, Math.min(n, room)));
  };
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="opt-h">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={tx.close} tabIndex={-1} onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full max-w-lg flex-col rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0"><h2 id="opt-h" className="text-lg font-semibold">{item.name}</h2>{item.description ? <p className="mt-0.5 text-sm text-muted">{item.description}</p> : null}</div>
          <button type="button" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label={tx.close}><X className="size-5" aria-hidden="true" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {groups.map((g) => {
            const count = g.choices.filter((c) => picked.includes(c.id)).length;
            return (
              <fieldset key={g.id}>
                <legend className="flex w-full flex-wrap items-baseline gap-x-2 text-sm font-semibold">{g.name}<span className="text-xs font-normal text-muted">{[g.required ? tx.required : "", g.multi && g.max ? fill(tx.upTo, { n: g.max }) : ""].filter(Boolean).join(" · ")}</span></legend>
                <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                  {g.choices.map((c) => {
                    const on = picked.includes(c.id);
                    const full = g.multi && !!g.max && count >= g.max && !on;
                    return (
                      <li key={c.id}>
                        <label className={cn("flex min-h-12 cursor-pointer items-center gap-3 px-3 text-sm", full && "cursor-not-allowed opacity-50")}>
                          <input type={g.multi ? "checkbox" : "radio"} name={`g-${g.id}`} checked={on} disabled={full} onChange={() => toggle(g, c.id)} className="size-4 accent-[var(--accent)]" />
                          <span className="flex-1">{c.name}</span>
                          {c.priceCents ? <span className="text-muted tabular-nums">+ {eur(c.priceCents)}</span> : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
        </div>
        <div className="space-y-3 border-t border-border p-4">
          {err ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{err}</p> : null}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-border-strong">
              <button type="button" onClick={() => setN((x) => Math.max(1, x - 1))} className="flex size-11 items-center justify-center" aria-label={fill(tx.lessAria, { name: item.name })}><Minus className="size-4" aria-hidden="true" /></button>
              <span className="w-6 text-center font-semibold tabular-nums">{n}</span>
              <button type="button" onClick={() => setN((x) => Math.min(room, x + 1))} disabled={n >= room} className="flex size-11 items-center justify-center disabled:opacity-30" aria-label={fill(tx.moreAria, { name: item.name })}><Plus className="size-4" aria-hidden="true" /></button>
            </span>
            <button type="button" onClick={confirm} disabled={room <= 0} className="flex h-12 flex-1 items-center justify-center rounded-xl bg-accent px-4 font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50">{room <= 0 ? tx.soldOut : fill(tx.addFor, { price: eur(unit * n) })}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

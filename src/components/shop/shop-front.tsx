"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Minus, Package, Plus, ShoppingBag, Store, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { MAX_SHOP_QTY, deliveryFee } from "@/lib/shop";
import { placeShopOrder } from "@/server/actions/shop-order";

type Item = { id: string; name: string; description: string | null; category: string | null; priceCents: number; photoUrl: string | null; trackStock: boolean; stockQty: number };
type Settings = { intro: string | null; pickup: boolean; pickupNote: string | null; delivery: boolean; deliveryCents: number; freeDeliveryFromCents: number | null; deliveryNote: string | null; payOnline: boolean; payOnPickup: boolean; payTransfer: boolean };
type Seller = { iban: string; legalName: string; street: string; zip: string; city: string; vat: string; bce: string; email: string } | null;
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);
const input = "h-11 w-full rounded-lg border border-border bg-surface px-3";

/** Vitrine, panier et commande (sans compte). */
export function ShopFront({ slug, business, settings: s, items, seller }: { slug: string; business: { name: string; photoUrl: string | null; city: string | null }; settings: Settings; items: Item[]; seller: Seller }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cat, setCat] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", address: "", note: "", fulfilment: s.pickup ? "pickup" : "delivery", payMethod: s.payOnline ? "online" : s.payOnPickup ? "pickup" : "transfer", terms: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = `sky-shop-${slug}`;
  useEffect(() => { try { const raw = localStorage.getItem(key); if (raw) setCart(JSON.parse(raw)); } catch {} }, [key]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(cart)); } catch {} }, [cart, key]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const lines = Object.entries(cart).filter(([id, q]) => q > 0 && byId.has(id));
  const itemsCents = lines.reduce((a, [id, q]) => a + byId.get(id)!.priceCents * q, 0);
  const fee = f.fulfilment === "delivery" ? deliveryFee(itemsCents, s) : 0;
  const count = lines.reduce((a, [, q]) => a + q, 0);
  const max = (it: Item) => (it.trackStock ? Math.min(MAX_SHOP_QTY, it.stockQty) : MAX_SHOP_QTY);
  const add = (it: Item, d: number) => setCart((c) => ({ ...c, [it.id]: Math.max(0, Math.min(max(it), (c[it.id] ?? 0) + d)) }));
  const cats = [...new Set(items.map((i) => i.category).filter((x): x is string => !!x))];
  const shown = items.filter((i) => !cat || i.category === cat);
  const payLabel = { online: "Carte ou Bancontact (en ligne)", pickup: f.fulfilment === "delivery" ? "À la livraison" : "Au retrait", transfer: "Virement bancaire" };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const r = await placeShopOrder({ slug, lines: lines.map(([productId, qty]) => ({ productId, qty })), fulfilment: f.fulfilment as "pickup" | "delivery", payMethod: f.payMethod as "online" | "pickup" | "transfer", name: f.name, email: f.email, phone: f.phone, address: f.address, note: f.note, terms: f.terms as true }).catch(() => ({ ok: false as const, error: "Envoi impossible. Vérifiez votre connexion." }));
      if (!r.ok) return setError(r.error);
      try { localStorage.removeItem(key); } catch {}
      window.location.href = r.url;
    });
  };

  return (
    <div className="min-h-dvh bg-bg pb-28">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
          {business.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.photoUrl} alt="" className="size-14 rounded-xl object-cover" />
          ) : <span className="flex size-14 items-center justify-center rounded-xl bg-accent-soft text-accent" aria-hidden="true"><Store className="size-7" /></span>}
          <div className="min-w-0"><h1 className="truncate text-xl font-semibold">{business.name}</h1><p className="text-sm text-muted">Boutique en ligne{business.city ? ` · ${business.city}` : ""}</p></div>
        </div>
        {s.intro ? <p className="mx-auto max-w-5xl px-4 pb-4 text-sm text-muted">{s.intro}</p> : null}
      </header>
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {cats.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Catégories">
            <button type="button" aria-pressed={!cat} onClick={() => setCat(null)} className={cn("h-9 shrink-0 rounded-full border px-3 text-sm", !cat ? "border-accent bg-accent-soft font-medium text-accent" : "border-border")}>Tout</button>
            {cats.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={cn("h-9 shrink-0 rounded-full border px-3 text-sm", cat === c ? "border-accent bg-accent-soft font-medium text-accent" : "border-border")}>{c}</button>)}
          </div>
        ) : null}
        {items.length === 0 ? <p className="py-16 text-center text-muted">Aucun produit en vente pour l&apos;instant.</p> : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((it) => {
              const q = cart[it.id] ?? 0;
              const out = it.trackStock && it.stockQty <= 0;
              return (
                <li key={it.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                  {it.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.photoUrl} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                  ) : <span className="flex aspect-square items-center justify-center bg-surface-muted text-muted" aria-hidden="true"><Package className="size-10" /></span>}
                  <div className="flex flex-1 flex-col p-3">
                    <p className="font-medium">{it.name}</p>
                    {it.description ? <p className="mt-0.5 line-clamp-3 text-sm text-muted">{it.description}</p> : null}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                      <span className="font-semibold tabular-nums">{eur(it.priceCents)}</span>
                      {out ? <span className="text-xs font-medium text-danger">Épuisé</span> : q ? (
                        <span className="inline-flex items-center rounded-full border border-border-strong">
                          <button type="button" onClick={() => add(it, -1)} className="flex size-10 items-center justify-center" aria-label={`Un ${it.name} de moins`}><Minus className="size-4" aria-hidden="true" /></button>
                          <span className="w-5 text-center text-sm font-semibold tabular-nums">{q}</span>
                          <button type="button" onClick={() => add(it, 1)} disabled={q >= max(it)} className="flex size-10 items-center justify-center disabled:opacity-30" aria-label={`Un ${it.name} de plus`}><Plus className="size-4" aria-hidden="true" /></button>
                        </span>
                      ) : <button type="button" onClick={() => add(it, 1)} className="inline-flex h-10 items-center gap-1 rounded-full bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover" aria-label={`Ajouter ${it.name} au panier`}><Plus className="size-4" aria-hidden="true" />Ajouter</button>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {seller ? (
          <footer className="border-t border-border pt-6 text-xs text-muted">
            <p>{seller.legalName || business.name}{seller.street ? ` · ${seller.street}, ${seller.zip} ${seller.city}` : ""}{seller.bce ? ` · BCE ${seller.bce}` : ""}{seller.vat ? ` · TVA ${seller.vat}` : ""}{seller.email ? ` · ${seller.email}` : ""}</p>
            <p className="mt-1">Prix TVA comprise. Droit de rétractation de 14 jours pour les achats en ligne (sauf produits périssables ou personnalisés) : contactez le vendeur.</p>
          </footer>
        ) : null}
      </main>

      {count ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 p-3 backdrop-blur">
          <button type="button" onClick={() => setOpen(true)} className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between rounded-xl bg-accent px-5 font-semibold text-accent-foreground hover:bg-accent-hover">
            <span className="flex items-center gap-2"><ShoppingBag className="size-5" aria-hidden="true" />Panier ({count})</span><span className="tabular-nums">{eur(itemsCents)}</span>
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="cart-h">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Fermer" tabIndex={-1} onClick={() => setOpen(false)} />
          <form onSubmit={submit} className="relative max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl" noValidate>
            <div className="flex items-center justify-between"><h2 id="cart-h" className="text-lg font-semibold">Votre commande</h2><button type="button" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label="Fermer"><X className="size-5" aria-hidden="true" /></button></div>
            <ul className="mt-2 divide-y divide-border text-sm">{lines.map(([id, q]) => <li key={id} className="flex justify-between py-2"><span>{q} × {byId.get(id)!.name}</span><span className="tabular-nums">{eur(q * byId.get(id)!.priceCents)}</span></li>)}</ul>
            <fieldset className="mt-4 space-y-2">
              <legend className="text-sm font-medium">Retrait ou livraison</legend>
              {s.pickup ? <label className="flex items-start gap-2 text-sm"><input type="radio" name="ful" checked={f.fulfilment === "pickup"} onChange={() => setF({ ...f, fulfilment: "pickup" })} className="mt-0.5 size-4" /><span>Retrait sur place (gratuit){s.pickupNote ? <span className="block text-muted">{s.pickupNote}</span> : null}</span></label> : null}
              {s.delivery ? <label className="flex items-start gap-2 text-sm"><input type="radio" name="ful" checked={f.fulfilment === "delivery"} onChange={() => setF({ ...f, fulfilment: "delivery" })} className="mt-0.5 size-4" /><span>Livraison ({deliveryFee(itemsCents, s) ? eur(deliveryFee(itemsCents, s)) : "gratuite"}){s.deliveryNote ? <span className="block text-muted">{s.deliveryNote}</span> : null}</span></label> : null}
            </fieldset>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="so-name" className="text-sm font-medium">Nom</label><input id="so-name" className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" maxLength={120} /></div>
              <div><label htmlFor="so-phone" className="text-sm font-medium">Téléphone</label><input id="so-phone" className={input} type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" maxLength={40} /></div>
              <div className="sm:col-span-2"><label htmlFor="so-email" className="text-sm font-medium">Email</label><input id="so-email" className={input} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" maxLength={200} /></div>
              {f.fulfilment === "delivery" ? <div className="sm:col-span-2"><label htmlFor="so-addr" className="text-sm font-medium">Adresse de livraison</label><input id="so-addr" className={input} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} autoComplete="street-address" maxLength={300} /></div> : null}
              <div className="sm:col-span-2"><label htmlFor="so-note" className="text-sm font-medium">Un mot pour le vendeur (facultatif)</label><input id="so-note" className={input} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} /></div>
            </div>
            <fieldset className="mt-4 space-y-2">
              <legend className="text-sm font-medium">Paiement</legend>
              {(["online", "pickup", "transfer"] as const).filter((k) => (k === "online" ? s.payOnline : k === "pickup" ? s.payOnPickup : s.payTransfer)).map((k) => <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="pay" checked={f.payMethod === k} onChange={() => setF({ ...f, payMethod: k })} className="size-4" />{payLabel[k]}</label>)}
            </fieldset>
            <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} className="mt-0.5 size-4" /><span>J&apos;accepte les conditions de vente et je confirme ma commande avec obligation de paiement.</span></label>
            {error ? <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
            <button type="submit" disabled={pending} className="mt-4 flex h-14 w-full items-center justify-between rounded-xl bg-accent px-5 font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-60"><span>{pending ? "Envoi…" : f.payMethod === "online" ? "Commander et payer" : "Commander"}</span><span className="tabular-nums">{eur(itemsCents + fee)}</span></button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

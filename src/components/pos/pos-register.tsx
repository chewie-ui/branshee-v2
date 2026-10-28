"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Minus, Package, Plus, Printer, ScanLine, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { BarcodeScanner, canScan } from "@/components/stock/barcode-scanner";
import { cn } from "@/lib/cn";
import { PAY_METHODS, VAT_RATES, cartTotals, changeDue, parseEuros, type PayMethod } from "@/lib/stock";
import { closeRegister, openRegister, sell } from "@/server/actions/pos";
import type { ProductView } from "@/server/stock";

type Line = { key: string; productId: string | null; name: string; qty: number; unitCents: number; vatRate: number; trackStock?: boolean; stock?: number };
type Res = { ok: boolean; message?: string; error?: string; id?: string; number?: string; change?: number | null };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

/** Ouverture de caisse : fond de caisse. */
export function OpenRegister() {
  const router = useRouter();
  const [cash, setCash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="mx-auto max-w-md p-6">
      <h2 className="text-lg font-semibold">Ouvrir la caisse</h2>
      <p className="mt-1 text-sm text-muted">Comptez les espèces du tiroir (le fond de caisse) pour pouvoir vérifier le compte à la fermeture.</p>
      <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); const c = cash.trim() ? parseEuros(cash) : 0; if (c === null) return setError("Montant invalide."); start(async () => { const r: Res = await openRegister(c).catch(() => ({ ok: false, error: "Ouverture impossible." })); if (!r.ok) return setError(r.error ?? "Ouverture impossible."); router.refresh(); }); }}>
        <Field label="Fond de caisse (€)" htmlFor="op-cash"><Input id="op-cash" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0,00" autoFocus /></Field>
        {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
        <Button type="submit" className="w-full" loading={pending}>Ouvrir la caisse</Button>
      </form>
      <p className="mt-4 text-xs text-muted">Restaurants et cafés (horeca) : la loi belge peut imposer une caisse enregistreuse certifiée (SCE, « boîte noire »). Cette caisse n&apos;est pas certifiée SCE : vérifiez avec votre comptable.</p>
    </Card>
  );
}

/** Écran de vente : produits (recherche, catégories, scan), ticket, encaissement espèces ou carte. */
export function PosRegister({ products, expectedCash, sessionInfo }: { products: ProductView[]; expectedCash: number; sessionInfo: string }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [discount, setDiscount] = useState("");
  const [pay, setPay] = useState<PayMethod | null>(null);
  const [given, setGiven] = useState("");
  const [free, setFree] = useState(false);
  const [closing, setClosing] = useState(false);
  const [scan, setScan] = useState(false);
  const [scannable, setScannable] = useState(false);
  const [done, setDone] = useState<{ id: string; number: string; change: number | null } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { setScannable(canScan()); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const cats = useMemo(() => [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))], [products]);
  const ql = q.trim().toLowerCase();
  const shown = products.filter((p) => (!cat || p.category === cat) && (!ql || p.name.toLowerCase().includes(ql) || p.barcode === q.trim()));
  const discountCents = discount.trim() ? (parseEuros(discount) ?? 0) : 0;
  const t = cartTotals(lines, discountCents);
  const givenCents = given.trim() ? parseEuros(given) : null;
  const change = givenCents !== null ? changeDue(t.total, givenCents) : null;

  const add = useCallback((p: ProductView) => {
    setDone(null);
    setMsg(null);
    setLines((ls) => {
      const i = ls.findIndex((l) => l.productId === p.id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: Math.min(999, l.qty + 1) } : l));
      return [...ls, { key: p.id, productId: p.id, name: p.name, qty: 1, unitCents: p.priceCents, vatRate: p.vatRate, trackStock: p.trackStock, stock: p.stockQty }];
    });
  }, []);
  const onCode = useCallback((code: string) => {
    setScan(false);
    const p = products.find((x) => x.barcode === code);
    if (p) add(p); else setMsg(`Aucun produit avec le code ${code}.`);
  }, [products, add]);
  const setQty = (key: string, qty: number) => setLines((ls) => (qty <= 0 ? ls.filter((l) => l.key !== key) : ls.map((l) => (l.key === key ? { ...l, qty: Math.min(999, qty) } : l))));
  const reset = () => { setLines([]); setDiscount(""); setGiven(""); setPay(null); };

  const checkout = (method: PayMethod) =>
    start(async () => {
      setMsg(null);
      const r: Res = await sell({ lines: lines.map((l) => (l.productId ? { productId: l.productId, qty: l.qty } : { productId: null, qty: l.qty, name: l.name, unitCents: l.unitCents, vatRate: l.vatRate })), discountCents, method, cashGivenCents: method === "cash" ? givenCents : null }).catch(() => ({ ok: false, error: "Encaissement impossible. Vérifiez votre connexion." }));
      if (!r.ok) return setMsg(r.error ?? "Encaissement impossible.");
      setDone({ id: r.id!, number: r.number!, change: r.change ?? null });
      reset();
      router.refresh();
      search.current?.focus();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <label htmlFor="pos-q" className="sr-only">Rechercher ou scanner</label>
            <Input ref={search} id="pos-q" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const exact = products.find((p) => p.barcode && p.barcode === q.trim()); const only = shown.length === 1 ? shown[0] : null; const p = exact ?? only; if (p) { add(p); setQ(""); } } }} placeholder="Rechercher ou scanner (lecteur USB)" className="pl-9" autoFocus />
          </div>
          {scannable ? <Button variant="secondary" icon={<ScanLine className="size-4" aria-hidden="true" />} onClick={() => setScan(true)}>Scanner</Button> : null}
          <Button variant="secondary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setFree(true)}>Montant libre</Button>
        </div>
        {cats.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Catégories">
            <button type="button" aria-pressed={!cat} onClick={() => setCat(null)} className={cn("h-9 shrink-0 rounded-full border px-3 text-sm", !cat ? "border-accent bg-accent-soft font-medium text-accent" : "border-border")}>Tout</button>
            {cats.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={cn("h-9 shrink-0 rounded-full border px-3 text-sm", cat === c ? "border-accent bg-accent-soft font-medium text-accent" : "border-border")}>{c}</button>)}
          </div>
        ) : null}
        {products.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted"><Package className="mx-auto mb-2 size-8" aria-hidden="true" />Aucun produit. Ajoutez-les dans l&apos;app Stock, ou utilisez « Montant libre ».</Card>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {shown.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => add(p)} className="flex h-full min-h-24 w-full flex-col justify-between rounded-xl border border-border bg-surface p-3 text-left shadow-sm transition-colors hover:border-accent active:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt="" className="mb-2 h-16 w-full rounded-lg object-cover" loading="lazy" />
                  ) : null}
                  <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                  <span className="mt-1 flex items-end justify-between gap-1">
                    <span className="font-semibold tabular-nums">{eur(p.priceCents)}</span>
                    {p.trackStock ? <span className={cn("text-xs tabular-nums", p.stockQty <= 0 ? "text-danger" : "text-muted")}>{p.stockQty} en stock</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Card className="flex h-fit flex-col p-4 lg:sticky lg:top-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Ticket</h2>
          <p className="text-xs text-muted">{sessionInfo}</p>
        </div>
        {done ? (
          <div className="mt-3 rounded-lg bg-success-soft p-3 text-sm text-success" role="status">
            <p className="font-semibold">Ticket {done.number} encaissé.</p>
            {done.change ? <p className="mt-1 text-lg font-semibold">À rendre : {eur(done.change)}</p> : null}
            <a href={`/imprimer/ticket/${done.id}`} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1.5 font-medium underline"><Printer className="size-4" aria-hidden="true" />Imprimer le ticket</a>
          </div>
        ) : null}
        {lines.length === 0 ? <p className="py-8 text-center text-sm text-muted">Touchez un produit pour l&apos;ajouter.</p> : (
          <ul className="mt-3 max-h-[40vh] divide-y divide-border overflow-y-auto">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="text-xs text-muted tabular-nums">{eur(l.unitCents)}{l.trackStock && l.stock !== undefined && l.qty > l.stock ? <span className="text-warning"> · stock {l.stock}</span> : null}</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-border">
                  <button type="button" onClick={() => setQty(l.key, l.qty - 1)} className="flex size-9 items-center justify-center" aria-label={`Un ${l.name} de moins`}><Minus className="size-4" aria-hidden="true" /></button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                  <button type="button" onClick={() => setQty(l.key, l.qty + 1)} className="flex size-9 items-center justify-center" aria-label={`Un ${l.name} de plus`}><Plus className="size-4" aria-hidden="true" /></button>
                </span>
                <span className="w-20 text-right text-sm font-medium tabular-nums">{eur(l.qty * l.unitCents)}</span>
              </li>
            ))}
          </ul>
        )}
        {lines.length ? (
          <>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
              <label htmlFor="pos-disc">Remise (€)</label>
              <Input id="pos-disc" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" className="h-9 w-28 text-right" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-sm text-muted">Total TVAC <span className="text-xs">(dont TVA {eur(t.vat)})</span></span>
              <span className="text-2xl font-semibold tabular-nums">{eur(t.total)}</span>
            </div>
            {pay === "cash" ? (
              <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
                <Field label="Reçu en espèces (€)" htmlFor="pos-given"><Input id="pos-given" inputMode="decimal" value={given} onChange={(e) => setGiven(e.target.value)} autoFocus /></Field>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set([Math.ceil(t.total / 500) * 500, Math.ceil(t.total / 1000) * 1000, Math.ceil(t.total / 2000) * 2000, Math.ceil(t.total / 5000) * 5000])].filter((v) => v >= t.total).slice(0, 4).map((v) => <button key={v} type="button" onClick={() => setGiven((v / 100).toFixed(2).replace(".", ","))} className="h-9 rounded-full border border-border px-3 text-sm tabular-nums hover:border-accent">{eur(v)}</button>)}
                </div>
                {givenCents !== null ? <p className={cn("text-sm font-semibold", change === null ? "text-danger" : "")}>{change === null ? "Montant insuffisant" : `À rendre : ${eur(change)}`}</p> : null}
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setPay(null)} disabled={pending}>Retour</Button>
                  <Button className="flex-1" loading={pending} disabled={givenCents !== null && change === null} onClick={() => checkout("cash")}>Encaisser</Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button className="h-14" variant="secondary" icon={<Banknote className="size-5" aria-hidden="true" />} onClick={() => setPay("cash")}>{PAY_METHODS.cash}</Button>
                <Button className="h-14" loading={pending} icon={<CreditCard className="size-5" aria-hidden="true" />} onClick={() => checkout("card")}>Carte</Button>
                <button type="button" onClick={reset} className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm text-muted hover:bg-surface-muted hover:text-danger"><Trash2 className="size-4" aria-hidden="true" />Vider le ticket</button>
              </div>
            )}
          </>
        ) : null}
        {msg ? <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{msg}</p> : null}
        <button type="button" onClick={() => setClosing(true)} className="mt-4 h-9 rounded-lg text-sm text-muted hover:bg-surface-muted hover:text-text">Fermer la caisse</button>
      </Card>

      {free ? <FreeLine onClose={() => setFree(false)} onAdd={(l) => { setLines((ls) => [...ls, l]); setFree(false); setDone(null); }} /> : null}
      {closing ? <CloseDialog expectedCash={expectedCash} onClose={() => setClosing(false)} /> : null}
      {scan ? <BarcodeScanner onCode={onCode} onClose={() => setScan(false)} /> : null}
    </div>
  );
}

function FreeLine({ onClose, onAdd }: { onClose: () => void; onAdd: (l: Line) => void }) {
  const [name, setName] = useState("Divers");
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState(21);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="fl-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <form onSubmit={(e) => { e.preventDefault(); const c = parseEuros(amount); if (!c) return setError("Montant invalide."); onAdd({ key: `free-${Date.now()}`, productId: null, name: name.trim() || "Divers", qty: 1, unitCents: c, vatRate: vat }); }} className="relative w-full max-w-sm rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl" noValidate>
        <div className="flex items-center justify-between"><h2 id="fl-title" className="text-lg font-semibold">Montant libre</h2><button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label="Fermer"><X className="size-5" aria-hidden="true" /></button></div>
        <div className="mt-4 space-y-3">
          <Field label="Libellé" htmlFor="fl-name"><Input id="fl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
          <Field label="Montant (€ TVAC)" htmlFor="fl-amount"><Input id="fl-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
          <Field label="TVA" htmlFor="fl-vat"><Select id="fl-vat" value={vat} onChange={(e) => setVat(Number(e.target.value))}>{VAT_RATES.map((r) => <option key={r} value={r}>{r} %</option>)}</Select></Field>
        </div>
        {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
        <Button type="submit" className="mt-5 w-full">Ajouter au ticket</Button>
      </form>
    </div>
  );
}

function CloseDialog({ expectedCash, onClose }: { expectedCash: number; onClose: () => void }) {
  const router = useRouter();
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const c = counted.trim() ? parseEuros(counted) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="cl-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <form onSubmit={(e) => { e.preventDefault(); if (c === null) return setError("Indiquez les espèces comptées."); start(async () => { const r: Res = await closeRegister({ countedCashCents: c, note }).catch(() => ({ ok: false, error: "Clôture impossible." })); if (!r.ok) return setError(r.error ?? "Clôture impossible."); router.push(`/app/caisse/clotures?z=${r.id}`); }); }} className="relative w-full max-w-sm rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl" noValidate>
        <h2 id="cl-title" className="text-lg font-semibold">Fermer la caisse</h2>
        <p className="mt-1 text-sm text-muted">Espèces attendues dans le tiroir : <span className="font-semibold text-text tabular-nums">{eur(expectedCash)}</span></p>
        <div className="mt-4 space-y-3">
          <Field label="Espèces comptées (€)" htmlFor="cl-count"><Input id="cl-count" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus /></Field>
          {c !== null ? <p className={cn("text-sm font-medium", c === expectedCash ? "text-success" : "text-warning")}>{c === expectedCash ? "Le compte est juste." : `Écart : ${eur(c - expectedCash)}`}</p> : null}
          <Field label="Note (facultatif)" htmlFor="cl-note"><Input id="cl-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
        </div>
        {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button type="submit" loading={pending}>Clôturer</Button>
        </div>
      </form>
    </div>
  );
}

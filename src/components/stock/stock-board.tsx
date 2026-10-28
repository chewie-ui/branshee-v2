"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, ImagePlus, Package, Plus, ScanLine, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { VAT_RATES, isLow } from "@/lib/stock";
import { deleteProduct, moveStock, restoreProduct, saveProduct } from "@/server/actions/stock";
import type { ProductView } from "@/server/stock";
import { BarcodeScanner, canScan } from "./barcode-scanner";

type Res = { ok: boolean; message?: string; error?: string };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);
const euroStr = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));

/** Produits et quantités : recherche (ou scan), stock bas, réception, sortie, inventaire. */
export function StockBoard({ products, canManage }: { products: ProductView[]; canManage: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "archived">("all");
  const [edit, setEdit] = useState<ProductView | "new" | null>(null);
  const [move, setMove] = useState<{ p: ProductView; reason: "in" | "out" | "count" } | null>(null);
  const [scan, setScan] = useState(false);
  const [scannable, setScannable] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newBarcode, setNewBarcode] = useState("");
  useEffect(() => { setScannable(canScan()); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const active = products.filter((p) => p.active);
  const low = active.filter(isLow);
  const value = active.reduce((a, p) => a + (p.trackStock && p.costCents && p.stockQty > 0 ? p.costCents * p.stockQty : 0), 0);
  const ql = q.trim().toLowerCase();
  const list = (filter === "archived" ? products.filter((p) => !p.active) : filter === "low" ? low : active).filter((p) => !ql || p.name.toLowerCase().includes(ql) || p.barcode === q.trim() || p.sku?.toLowerCase() === ql || p.category?.toLowerCase().includes(ql));

  const onCode = useCallback((code: string) => {
    setScan(false);
    const p = products.find((x) => x.barcode === code);
    if (p) { setQ(code); setMsg(null); setMove({ p, reason: "in" }); }
    else if (canManage) { setNewBarcode(code); setEdit("new"); setMsg({ ok: false, text: `Code ${code} inconnu : créez le produit.` }); }
    else setMsg({ ok: false, text: `Aucun produit avec le code ${code}.` });
  }, [products, canManage]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-sm text-muted">Produits</p><p className="mt-1 text-xl font-semibold tabular-nums">{active.length}</p></Card>
        <Card className={cn("p-4", low.length && "border-warning")}><p className="text-sm text-muted">Stock bas</p><p className={cn("mt-1 text-xl font-semibold tabular-nums", low.length && "text-warning")}>{low.length}</p><p className="text-xs text-muted">Sous le seuil d&apos;alerte</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Valeur du stock</p><p className="mt-1 text-xl font-semibold tabular-nums">{eur(value)}</p><p className="text-xs text-muted">Au prix d&apos;achat HTVA</p></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <label htmlFor="st-q" className="sr-only">Rechercher un produit ou scanner un code-barres</label>
          <Input id="st-q" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && /^[\w-]{4,}$/.test(q.trim())) { const p = products.find((x) => x.barcode === q.trim()); if (p) { e.preventDefault(); setMove({ p, reason: "in" }); } } }} placeholder="Nom, catégorie ou code-barres" className="pl-9" />
        </div>
        {scannable ? <Button variant="secondary" icon={<ScanLine className="size-4" aria-hidden="true" />} onClick={() => setScan(true)}>Scanner</Button> : null}
        <div className="inline-flex rounded-lg bg-surface-muted p-1" role="group" aria-label="Produits affichés">
          {([["all", "Tous"], ["low", `Stock bas (${low.length})`], ["archived", "Archivés"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn("h-8 rounded-md px-3 text-sm font-medium", filter === k ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>{l}</button>)}
        </div>
        {canManage ? <Button className="ml-auto" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => { setNewBarcode(""); setMsg(null); setEdit("new"); }}>Nouveau produit</Button> : null}
      </div>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}

      {products.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-medium">Aucun produit</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Ajoutez vos produits avec leur prix et leur quantité. Ils sont aussitôt disponibles dans l&apos;app Caisse, et le stock baisse à chaque vente.</p>
          {canManage ? <Button className="mt-4" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEdit("new")}>Ajouter un produit</Button> : null}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {list.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">Aucun produit ne correspond.</p> : (
            <ul className="divide-y divide-border">
              {list.map((p) => {
                const lowP = isLow(p);
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-5">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
                    ) : <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted" aria-hidden="true"><Package className="size-5" /></span>}
                    <button type="button" disabled={!canManage} onClick={() => { setMsg(null); setEdit(p); }} className="min-w-0 flex-1 text-left disabled:cursor-default">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-sm text-muted">{[p.category, p.barcode, `${eur(p.priceCents)} TVAC`].filter(Boolean).join(" · ")}</span>
                    </button>
                    <span className={cn("w-24 shrink-0 text-right", lowP && "text-warning")}>
                      {p.trackStock ? <><span className="text-lg font-semibold tabular-nums">{p.stockQty}</span><span className="block text-xs text-muted">{lowP ? <span className="inline-flex items-center gap-1 text-warning"><AlertTriangle className="size-3" aria-hidden="true" />seuil {p.minQty}</span> : p.minQty !== null ? `seuil ${p.minQty}` : "en stock"}</span></> : <span className="text-xs text-muted">Stock non suivi</span>}
                    </span>
                    {p.active && p.trackStock ? (
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => setMove({ p, reason: "in" })} className="flex size-10 items-center justify-center rounded-lg border border-border hover:bg-surface-muted" aria-label={`Réception de ${p.name}`} title="Réception"><ArrowDownToLine className="size-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => setMove({ p, reason: "out" })} className="flex size-10 items-center justify-center rounded-lg border border-border hover:bg-surface-muted" aria-label={`Sortie de ${p.name}`} title="Sortie (casse, usage…)"><ArrowUpFromLine className="size-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => setMove({ p, reason: "count" })} className="flex size-10 items-center justify-center rounded-lg border border-border hover:bg-surface-muted" aria-label={`Inventaire de ${p.name}`} title="Inventaire"><ClipboardCheck className="size-4" aria-hidden="true" /></button>
                      </div>
                    ) : !p.active && canManage ? <RestoreButton id={p.id} onDone={(t) => { setMsg({ ok: true, text: t }); router.refresh(); }} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {edit ? <ProductDialog product={edit === "new" ? null : edit} barcode={newBarcode} categories={[...new Set(products.map((p) => p.category).filter((c): c is string => !!c))]} onClose={() => setEdit(null)} onDone={(t) => { setEdit(null); setMsg({ ok: true, text: t }); router.refresh(); }} /> : null}
      {move ? <MoveDialog p={move.p} reason={move.reason} onClose={() => setMove(null)} onDone={(t) => { setMove(null); setMsg({ ok: true, text: t }); router.refresh(); }} /> : null}
      {scan ? <BarcodeScanner onCode={onCode} onClose={() => setScan(false)} /> : null}
    </div>
  );
}

function RestoreButton({ id, onDone }: { id: string; onDone: (t: string) => void }) {
  const [pending, start] = useTransition();
  return <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => { const r: Res = await restoreProduct(id); onDone(r.message ?? r.error ?? ""); })}>Remettre en vente</Button>;
}

const TITLES = { in: "Réception", out: "Sortie", count: "Inventaire" } as const;
const HINTS = { in: "Combien en recevez-vous ?", out: "Combien en sortez-vous (casse, usage interne, perte) ?", count: "Combien en comptez-vous en rayon ?" } as const;

function MoveDialog({ p, reason, onClose, onDone }: { p: ProductView; reason: "in" | "out" | "count"; onClose: () => void; onDone: (t: string) => void }) {
  const [qty, setQty] = useState(reason === "count" ? String(p.stockQty) : "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(qty);
    if (!/^\d{1,7}$/.test(qty.trim())) return setError("Quantité invalide.");
    start(async () => {
      setError(null);
      const r: Res = await moveStock({ productId: p.id, reason, qty: n, note }).catch(() => ({ ok: false, error: "Envoi impossible. Vérifiez votre connexion." }));
      if (!r.ok) return setError(r.error ?? "Envoi impossible.");
      onDone(r.message ?? "Enregistré.");
    });
  };
  const after = reason === "in" ? p.stockQty + (Number(qty) || 0) : reason === "out" ? p.stockQty - (Number(qty) || 0) : Number(qty) || 0;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="mv-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-sm rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl" noValidate>
        <h2 id="mv-title" className="text-lg font-semibold">{TITLES[reason]} · {p.name}</h2>
        <p className="mt-1 text-sm text-muted">En stock : {p.stockQty}</p>
        <div className="mt-4 space-y-3">
          <Field label={HINTS[reason]} htmlFor="mv-qty"><Input ref={ref} id="mv-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} className="text-lg" /></Field>
          <Field label="Note (facultatif)" htmlFor="mv-note"><Input id="mv-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={reason === "in" ? "N° de bon de livraison, fournisseur…" : ""} /></Field>
          {qty ? <p className="text-sm">Nouveau stock : <span className="font-semibold tabular-nums">{after}</span></p> : null}
        </div>
        {error ? <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button type="submit" loading={pending}>Valider</Button>
        </div>
      </form>
    </div>
  );
}

function ProductDialog({ product, barcode, categories, onClose, onDone }: { product: ProductView | null; barcode: string; categories: string[]; onClose: () => void; onDone: (t: string) => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [track, setTrack] = useState(product?.trackStock ?? true);
  const [file, setFile] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (track) fd.set("trackStock", "1"); else fd.delete("trackStock");
    if (removePhoto) fd.set("removePhoto", "1");
    start(async () => {
      setError(null);
      const r: Res = await saveProduct(fd).catch(() => ({ ok: false, error: "Envoi impossible. Vérifiez votre connexion et réessayez." }));
      if (!r.ok) return setError(r.error ?? "Envoi impossible.");
      onDone(r.message ?? "Enregistré.");
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pr-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <form ref={ref} onSubmit={submit} className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl" noValidate>
        <h2 id="pr-title" className="text-lg font-semibold">{product ? "Modifier le produit" : "Nouveau produit"}</h2>
        {product ? <input type="hidden" name="id" value={product.id} /> : null}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nom" htmlFor="pr-name" className="sm:col-span-2"><Input id="pr-name" name="name" defaultValue={product?.name ?? ""} maxLength={120} required /></Field>
          <Field label="Prix de vente (€ TVAC)" htmlFor="pr-price"><Input id="pr-price" name="price" inputMode="decimal" defaultValue={euroStr(product?.priceCents)} placeholder="0,00" /></Field>
          <Field label="TVA" htmlFor="pr-vat"><Select id="pr-vat" name="vatRate" defaultValue={product?.vatRate ?? 21}>{VAT_RATES.map((r) => <option key={r} value={r}>{r} %</option>)}</Select></Field>
          <Field label="Prix d'achat (€ HTVA)" htmlFor="pr-cost" hint="Pour la valeur du stock et la marge"><Input id="pr-cost" name="cost" inputMode="decimal" defaultValue={euroStr(product?.costCents)} /></Field>
          <Field label="Catégorie" htmlFor="pr-cat"><Input id="pr-cat" name="category" list="pr-cats" defaultValue={product?.category ?? ""} maxLength={60} /><datalist id="pr-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></Field>
          <Field label="Code-barres" htmlFor="pr-bar"><Input id="pr-bar" name="barcode" defaultValue={product?.barcode ?? barcode} maxLength={40} inputMode="numeric" /></Field>
          <Field label="Référence (facultatif)" htmlFor="pr-sku"><Input id="pr-sku" name="sku" defaultValue={product?.sku ?? ""} maxLength={60} /></Field>
          <Field label="Fournisseur (facultatif)" htmlFor="pr-sup" className="sm:col-span-2"><Input id="pr-sup" name="supplier" defaultValue={product?.supplier ?? ""} maxLength={120} /></Field>
        </div>
        <fieldset className="mt-4 rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-medium">Stock</legend>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={track} onChange={(e) => setTrack(e.target.checked)} className="size-4" />Suivre le stock de ce produit</label>
          {track ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {!product ? <Field label="Quantité en stock" htmlFor="pr-qty"><Input id="pr-qty" name="stockQty" inputMode="numeric" defaultValue="0" /></Field> : null}
              <Field label="Alerte sous" htmlFor="pr-min" hint="Vous êtes prévenu par email"><Input id="pr-min" name="minQty" inputMode="numeric" defaultValue={product?.minQty ?? ""} /></Field>
            </div>
          ) : <p className="mt-2 text-xs text-muted">Pour un service ou un produit sans stock (ex. : carte cadeau, prestation).</p>}
        </fieldset>
        <fieldset className="mt-4 rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-medium">Boutique en ligne</legend>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="onlineEnabled" value="1" defaultChecked={product?.onlineEnabled ?? false} className="size-4" />En vente sur la boutique en ligne</label>
          <label htmlFor="pr-desc" className="mt-3 block text-sm">Description (facultatif)</label>
          <textarea id="pr-desc" name="description" rows={2} maxLength={1000} defaultValue={product?.description ?? ""} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
        </fieldset>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="pr-photo" className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted focus-within:outline-2 focus-within:outline-accent"><ImagePlus className="size-4" aria-hidden="true" />{product?.photoUrl || file ? "Changer la photo" : "Ajouter une photo"}</label>
          <input id="pr-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0]?.name ?? null); setRemovePhoto(false); }} />
          <span className="text-sm text-muted">{file ?? (product?.photoUrl && !removePhoto ? "Photo en place" : "Aucune photo")}</span>
          {product?.photoUrl && !file && !removePhoto ? <button type="button" className="text-sm font-medium text-danger" onClick={() => setRemovePhoto(true)}>Retirer</button> : null}
        </div>
        {error ? <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {product?.active ? <Button type="button" variant="ghost" className="text-danger sm:mr-auto" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)} disabled={pending}>Retirer</Button> : <span className="sm:mr-auto" />}
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button type="submit" loading={pending}>Enregistrer</Button>
        </div>
      </form>
      <ConfirmDialog open={confirm} title="Retirer ce produit ?" confirmLabel="Retirer" danger loading={pending} onCancel={() => setConfirm(false)} onConfirm={() => product && start(async () => { const r: Res = await deleteProduct(product.id); if (!r.ok) { setConfirm(false); return setError(r.error ?? "Impossible."); } onDone(r.message ?? "Retiré."); })}>
        S&apos;il figure sur des tickets de caisse, il est archivé (et peut être remis en vente) ; sinon il est supprimé.
      </ConfirmDialog>
    </div>
  );
}

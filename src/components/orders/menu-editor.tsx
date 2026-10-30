"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { eur } from "@/lib/orders";
import { deleteCategory, deleteMenuItem, moveCategory, saveCategory, saveMenuItem, setItemAvailable } from "@/server/actions/orders";
import type { MenuCategoryView, MenuItemView } from "@/server/orders";

type Res = { ok: boolean; message?: string; error?: string };

/** Gestion de la carte : rubriques, plats (photo, prix, allergènes), disponible / épuisé. */
export function MenuEditor({ categories, items, canEdit }: { categories: MenuCategoryView[]; items: MenuItemView[]; canEdit: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [edit, setEdit] = useState<MenuItemView | { categoryId: string | null } | null>(null);
  const [newCat, setNewCat] = useState("");
  const [rename, setRename] = useState<{ id: string; name: string } | null>(null);
  const [delCat, setDelCat] = useState<MenuCategoryView | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>, after?: () => void) =>
    start(async () => {
      const r: Res = await fn().catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion." }));
      setMsg(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: r.error ?? "Action impossible." });
      if (r.ok) after?.();
      router.refresh();
    });
  const groups = [...categories.map((c) => ({ cat: c as MenuCategoryView | null, items: items.filter((i) => i.categoryId === c.id) })), { cat: null, items: items.filter((i) => !i.categoryId || !categories.some((c) => c.id === i.categoryId)) }];

  return (
    <div className="space-y-4">
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      {canEdit ? (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(() => saveCategory(null, newCat), () => setNewCat("")); }}>
          <label htmlFor="new-cat" className="sr-only">Nouvelle rubrique</label>
          <Input id="new-cat" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nouvelle rubrique : Entrées, Plats…" maxLength={60} className="max-w-sm flex-1" />
          <Button type="submit" variant="secondary" disabled={!newCat.trim() || pending} icon={<Plus className="size-4" aria-hidden="true" />}>Ajouter la rubrique</Button>
          <Button type="button" className="ml-auto" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => { setMsg(null); setEdit({ categoryId: categories[0]?.id ?? null }); }}>Nouveau plat</Button>
        </form>
      ) : <p className="text-sm text-muted">Seul le responsable modifie la carte. Vous pouvez marquer un plat épuisé.</p>}

      {groups.map(({ cat, items: list }, gi) => {
        if (!cat && !list.length) return null;
        return (
          <Card key={cat?.id ?? "none"} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
              {rename && cat && rename.id === cat.id ? (
                <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); run(() => saveCategory(cat.id, rename.name), () => setRename(null)); }}>
                  <label htmlFor={`rn-${cat.id}`} className="sr-only">Nom de la rubrique</label>
                  <Input id={`rn-${cat.id}`} value={rename.name} onChange={(e) => setRename({ ...rename, name: e.target.value })} maxLength={60} autoFocus className="max-w-xs" />
                  <Button size="sm" type="submit" loading={pending}>OK</Button>
                  <Button size="sm" type="button" variant="ghost" onClick={() => setRename(null)}>Annuler</Button>
                </form>
              ) : (
                <h2 className="flex-1 font-semibold">{cat?.name ?? "Sans rubrique"} <span className="font-normal text-muted">· {list.length}</span></h2>
              )}
              {canEdit && cat && !(rename?.id === cat.id) ? (
                <div className="flex items-center gap-1">
                  <button type="button" disabled={gi === 0 || pending} onClick={() => run(() => moveCategory(cat.id, -1))} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted disabled:opacity-30" aria-label={`Monter ${cat.name}`}><ChevronUp className="size-4" aria-hidden="true" /></button>
                  <button type="button" disabled={gi === categories.length - 1 || pending} onClick={() => run(() => moveCategory(cat.id, 1))} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted disabled:opacity-30" aria-label={`Descendre ${cat.name}`}><ChevronDown className="size-4" aria-hidden="true" /></button>
                  <button type="button" onClick={() => setRename({ id: cat.id, name: cat.name })} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label={`Renommer ${cat.name}`}><Pencil className="size-4" aria-hidden="true" /></button>
                  <button type="button" onClick={() => setDelCat(cat)} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label={`Supprimer ${cat.name}`}><Trash2 className="size-4" aria-hidden="true" /></button>
                  <Button size="sm" variant="ghost" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => { setMsg(null); setEdit({ categoryId: cat.id }); }}>Plat</Button>
                </div>
              ) : null}
            </div>
            {list.length ? (
              <ul className="divide-y divide-border">
                {list.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-5">
                    {it.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.photoUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                    ) : <span className="hidden size-12 shrink-0 rounded-lg bg-surface-muted sm:block" aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-medium break-words", !it.available && "text-muted line-through")}>{it.name}</p>
                      <p className="truncate text-sm text-muted">{it.description || it.tags || " "}</p>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">{eur(it.priceCents)}</span>
                    <button type="button" disabled={pending} aria-pressed={!it.available} onClick={() => run(() => setItemAvailable(it.id, !it.available))} className={cn("inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition-colors", it.available ? "border-border text-muted hover:border-danger hover:text-danger" : "border-danger bg-danger-soft text-danger hover:bg-danger-soft/70")} aria-label={it.available ? `Marquer ${it.name} épuisé` : `Remettre ${it.name} en vente`}>
                      {it.available ? "Épuiser" : "Épuisé"}
                    </button>
                    {canEdit ? <button type="button" onClick={() => { setMsg(null); setEdit(it); }} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label={`Modifier ${it.name}`}><Pencil className="size-4" aria-hidden="true" /></button> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-6 text-sm text-muted">Aucun plat dans cette rubrique.</p>}
          </Card>
        );
      })}
      {!categories.length && !items.length ? <Card className="p-8 text-center"><p className="font-medium">Votre carte est vide</p><p className="mt-1 text-sm text-muted">Créez des rubriques (Entrées, Plats, Boissons…) puis ajoutez vos plats avec leur prix.</p></Card> : null}

      {edit ? <ItemDialog item={"id" in edit ? edit : null} defaultCategory={edit.categoryId} categories={categories} onClose={() => setEdit(null)} onDone={(t) => { setEdit(null); setMsg({ ok: true, text: t }); router.refresh(); }} /> : null}
      <ConfirmDialog open={!!delCat} title={`Supprimer la rubrique « ${delCat?.name ?? ""} » ?`} confirmLabel="Supprimer" danger loading={pending} onCancel={() => setDelCat(null)} onConfirm={() => delCat && run(() => deleteCategory(delCat.id), () => setDelCat(null))}>
        Les plats de cette rubrique restent sur la carte, sans rubrique.
      </ConfirmDialog>
    </div>
  );
}

function ItemDialog({ item, defaultCategory, categories, onClose, onDone }: { item: MenuItemView | null; defaultCategory: string | null; categories: MenuCategoryView[]; onClose: () => void; onDone: (t: string) => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input:not([type=hidden])")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (removePhoto) fd.set("removePhoto", "1");
    start(async () => {
      setError(null);
      const r = await saveMenuItem(fd).catch(() => ({ ok: false as const, error: "Envoi impossible. Vérifiez votre connexion et réessayez." }));
      if (!r.ok) return setError(r.error);
      onDone(r.message ?? "Enregistré.");
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="item-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <form ref={ref} onSubmit={submit} className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl" noValidate>
        <h2 id="item-title" className="text-lg font-semibold">{item ? "Modifier le plat" : "Nouveau plat"}</h2>
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nom" htmlFor="it-name" className="sm:col-span-2"><Input id="it-name" name="name" defaultValue={item?.name ?? ""} maxLength={80} required placeholder="Ex. : Boulets sauce lapin" /></Field>
          <Field label="Prix (€)" htmlFor="it-price"><Input id="it-price" name="price" inputMode="decimal" defaultValue={item ? (item.priceCents / 100).toFixed(2).replace(".", ",") : ""} required placeholder="0,00" /></Field>
          <Field label="Rubrique" htmlFor="it-cat">
            <Select id="it-cat" name="categoryId" defaultValue={item ? (item.categoryId ?? "") : (defaultCategory ?? "")}>
              <option value="">Sans rubrique</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Description (facultatif)" htmlFor="it-desc" className="sm:col-span-2"><Input id="it-desc" name="description" defaultValue={item?.description ?? ""} maxLength={300} /></Field>
          <Field label="Allergènes et mentions (facultatif)" htmlFor="it-tags" hint="Ex. : végétarien, gluten, lactose" className="sm:col-span-2"><Input id="it-tags" name="tags" defaultValue={item?.tags ?? ""} maxLength={120} /></Field>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium">Photo</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label htmlFor="it-photo" className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted focus-within:outline-2 focus-within:outline-accent">
              <ImagePlus className="size-4" aria-hidden="true" />{item?.photoUrl || file ? "Remplacer" : "Ajouter une photo"}
            </label>
            <input id="it-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0]?.name ?? null); setRemovePhoto(false); }} />
            <span className="text-sm text-muted">{file ?? (item?.photoUrl && !removePhoto ? "Photo en place" : "Aucune photo")}</span>
            {item?.photoUrl && !file && !removePhoto ? <button type="button" className="text-sm font-medium text-danger" onClick={() => setRemovePhoto(true)}>Retirer</button> : null}
          </div>
          <p className="mt-1 text-xs text-muted">JPG, PNG ou WebP, 5 Mo maximum.</p>
        </div>
        {error ? <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {item ? <Button type="button" variant="ghost" className="text-danger sm:mr-auto" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)} disabled={pending}>Supprimer</Button> : <span className="sm:mr-auto" />}
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button type="submit" loading={pending}>Enregistrer</Button>
        </div>
      </form>
      <ConfirmDialog open={confirm} title="Retirer ce plat de la carte ?" confirmLabel="Supprimer" danger loading={pending} onCancel={() => setConfirm(false)} onConfirm={() => item && start(async () => { const r = await deleteMenuItem(item.id); if (!r.ok) { setConfirm(false); return setError(r.error); } onDone(r.message ?? "Supprimé."); })}>
        Le plat disparaît de la carte. Les commandes déjà passées ne changent pas.
      </ConfirmDialog>
    </div>
  );
}

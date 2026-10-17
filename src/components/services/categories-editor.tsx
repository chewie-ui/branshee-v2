"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { deleteCategory, moveCategory, saveCategory, setCategoryStyle } from "@/server/actions/services";

type Cat = { id: string; name: string; icon: string | null; count: number };
const SUGGESTED = ["💆", "🦴", "🏃", "🧘", "💪", "🩺", "✂️", "💅", "🧖", "👶", "🧠", "🏷️"];

function CategoryForm({ initial, onDone }: { initial: { id: string | null; name: string; icon: string }; onDone: () => void }) {
  const [name, setName] = useState(initial.name);
  const [icon, setIcon] = useState(initial.icon);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-muted/50 p-4">
      <div className="flex flex-wrap gap-2">
        <Input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} className="w-16 text-center text-lg" aria-label="Icône (emoji)" placeholder="🏷️" />
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className="min-w-48 flex-1" aria-label="Nom de la catégorie" placeholder="Ex. Kinésithérapie, Sport, Bien-être…" autoFocus />
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Icônes suggérées">
        {SUGGESTED.map((e) => (
          <button key={e} type="button" onClick={() => setIcon(e)} className={cn("flex size-9 items-center justify-center rounded-lg text-lg hover:bg-surface", icon === e && "bg-surface ring-1 ring-accent")} aria-label={`Icône ${e}`}>{e}</button>
        ))}
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone} disabled={pending}>Annuler</Button>
        <Button size="sm" loading={pending} onClick={() => start(async () => { const r = await saveCategory(initial.id, { name, icon }); if (r.ok) onDone(); else setError(r.error ?? "Erreur."); })}>Enregistrer</Button>
      </div>
    </div>
  );
}

export function CategoriesEditor({ categories, style }: { categories: Cat[]; style: "pills" | "accordion" | "grid" }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(style);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Catégories" description="Regroupez vos prestations sur votre page de réservation (ex. Kinésithérapie, Sport). Propres à cet établissement." action={editing !== "new" ? <Button size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing("new")}>Nouvelle catégorie</Button> : null} />
        <div className="space-y-3 p-5">
          {editing === "new" ? <CategoryForm initial={{ id: null, name: "", icon: "" }} onDone={() => setEditing(null)} /> : null}
          {categories.length === 0 && editing !== "new" ? <p className="text-sm text-muted">Aucune catégorie pour le moment.</p> : null}
          <ul className="divide-y divide-border rounded-lg border border-border">
            {categories.map((c, i) =>
              editing === c.id ? (
                <li key={c.id} className="p-2"><CategoryForm initial={{ id: c.id, name: c.name, icon: c.icon ?? "" }} onDone={() => setEditing(null)} /></li>
              ) : (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-lg" aria-hidden="true">{c.icon || "🏷️"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-sm text-muted">{c.count} prestation{c.count > 1 ? "s" : ""}</p>
                  </div>
                  {confirm === c.id ? (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="hidden text-danger sm:inline">Supprimer ? Ses prestations restent, sans catégorie.</span>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}><X className="size-4" aria-label="Non" /></Button>
                      <Button size="sm" variant="danger" loading={pending} onClick={() => start(async () => { await deleteCategory(c.id); setConfirm(null); })}><Check className="size-4" aria-label="Oui, supprimer" /></Button>
                    </span>
                  ) : (
                    <div className="flex shrink-0 items-center">
                      <button type="button" disabled={i === 0 || pending} onClick={() => start(async () => void (await moveCategory(c.id, "up")))} className="flex size-8 items-center justify-center rounded text-muted hover:text-text disabled:opacity-25" aria-label={`Monter ${c.name}`}><ArrowUp className="size-4" aria-hidden="true" /></button>
                      <button type="button" disabled={i === categories.length - 1 || pending} onClick={() => start(async () => void (await moveCategory(c.id, "down")))} className="flex size-8 items-center justify-center rounded text-muted hover:text-text disabled:opacity-25" aria-label={`Descendre ${c.name}`}><ArrowDown className="size-4" aria-hidden="true" /></button>
                      <button type="button" onClick={() => setEditing(c.id)} className="flex size-8 items-center justify-center rounded text-muted hover:text-text" aria-label={`Renommer ${c.name}`}><Pencil className="size-4" aria-hidden="true" /></button>
                      <button type="button" onClick={() => setConfirm(c.id)} className="flex size-8 items-center justify-center rounded text-muted hover:text-danger" aria-label={`Supprimer ${c.name}`}><Trash2 className="size-4" aria-hidden="true" /></button>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        </div>
      </Card>

      <Card>
        <CardHeader title="Affichage sur la page de réservation" />
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {([["pills", "Pastilles", "Un filtre par catégorie au-dessus de la liste."], ["accordion", "Accordéon", "Chaque catégorie se déplie."], ["grid", "Liste groupée", "Toutes les prestations, groupées par catégorie."]] as const).map(([v, t, d]) => (
            <button key={v} type="button" aria-pressed={current === v} disabled={pending} onClick={() => { setCurrent(v); start(async () => void (await setCategoryStyle(v))); }} className={cn("rounded-xl border p-4 text-left", current === v ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong")}>
              <span className="block text-sm font-semibold">{t}</span>
              <span className="mt-0.5 block text-sm text-muted">{d}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

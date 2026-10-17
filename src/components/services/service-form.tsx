"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { deleteService, saveService, type ServiceFormState } from "@/server/actions/services";
import { submitKeepingValues } from "@/lib/form";

export const SERVICE_COLORS = ["#4f46e5", "#2563eb", "#0891b2", "#0d9488", "#059669", "#65a30d", "#d97706", "#dc2626", "#db2777", "#7c3aed", "#52525b"];
const DURATIONS = [5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 240];

type Initial = {
  id: string | null;
  name: string;
  description: string;
  categoryId: string;
  durationMin: number;
  price: string;
  color: string;
  audience: "all" | "new" | "existing";
  isActive: boolean;
  memberIds: string[];
};

type Props = {
  initial: Initial;
  categories: { id: string; name: string }[];
  team: { id: string; name: string }[];
  showAudience: boolean;
};

const fmt = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m / 60} h`);

export function ServiceForm({ initial, categories, team, showAudience }: Props) {
  const [state, action, pending] = useActionState<ServiceFormState, FormData>(saveService.bind(null, initial.id), undefined);
  const [category, setCategory] = useState(initial.categoryId);
  const [color, setColor] = useState(initial.color);
  const [everyone, setEveryone] = useState(initial.memberIds.length === 0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();
  const err = state?.fieldErrors ?? {};
  const durations = DURATIONS.includes(initial.durationMin) ? DURATIONS : [...DURATIONS, initial.durationMin].sort((a, b) => a - b);

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-6" noValidate>
      {state?.error ? <p className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{state.error}</p> : null}

      <Card className="space-y-5 p-5">
        <Field label="Nom" htmlFor="name" error={err.name}>
          <Input id="name" name="name" defaultValue={initial.name} placeholder="Séance de kinésithérapie" maxLength={80} aria-invalid={!!err.name || undefined} />
        </Field>
        <Field label="Description (facultatif)" htmlFor="description" hint="Affichée aux clients sous le nom de la prestation.">
          <Textarea id="description" name="description" defaultValue={initial.description} rows={3} maxLength={500} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Durée" htmlFor="durationMin" error={err.durationMin}>
            <Select id="durationMin" name="durationMin" defaultValue={String(initial.durationMin)}>
              {durations.map((d) => (
                <option key={d} value={d}>{fmt(d)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Prix (facultatif)" htmlFor="price" error={err.price} hint="Laisser vide pour ne pas afficher de prix.">
            <div className="relative">
              <Input id="price" name="price" inputMode="decimal" defaultValue={initial.price} placeholder="45" className="pr-9" aria-invalid={!!err.price || undefined} />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">€</span>
            </div>
          </Field>
          <Field label="Catégorie" htmlFor="categoryId">
            <Select id="categoryId" name="categoryId" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Sans catégorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new">+ Nouvelle catégorie…</option>
            </Select>
          </Field>
          {category === "__new" ? (
            <Field label="Nom de la catégorie" htmlFor="newCategory">
              <Input id="newCategory" name="newCategory" maxLength={50} autoFocus />
            </Field>
          ) : null}
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Couleur dans l&apos;agenda</legend>
          <input type="hidden" name="color" value={color} />
          <div className="flex flex-wrap gap-2">
            {SERVICE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Couleur ${c}`}
                aria-pressed={color === c}
                className={cn("size-8 rounded-full ring-offset-2 transition-shadow", color === c ? "ring-2 ring-text" : "hover:ring-2 hover:ring-border-strong")}
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className="space-y-5 p-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Qui réalise cette prestation ?</legend>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            Toute l&apos;équipe
          </label>
          {!everyone ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {team.map((m) => (
                <label key={m.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-surface-muted">
                  <input type="checkbox" name="memberIds" value={m.id} defaultChecked={initial.memberIds.includes(m.id)} className="size-4 accent-[var(--accent)]" />
                  {m.name}
                </label>
              ))}
            </div>
          ) : null}
        </fieldset>

        {showAudience ? (
          <Field label="Proposée à" htmlFor="audience" hint="Selon la réponse à la question « première visite ? » posée avant la réservation.">
            <Select id="audience" name="audience" defaultValue={initial.audience}>
              <option value="all">Tous les clients</option>
              <option value="new">Nouveaux clients uniquement</option>
              <option value="existing">Clients déjà venus uniquement</option>
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="audience" value={initial.audience} />
        )}

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={initial.isActive} className="mt-0.5 size-4 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">Réservable en ligne</span>
            <span className="block text-muted">Décochez pour la masquer de votre page sans la supprimer.</span>
          </span>
        </label>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        {initial.id ? (
          confirmDelete ? (
            <div className="flex items-center gap-2 sm:mr-auto">
              <span className="text-sm text-danger">Supprimer définitivement ?</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>Non</Button>
              <Button type="button" variant="danger" size="sm" loading={deleting} onClick={() => startDelete(async () => void (await deleteService(initial.id!)))}>Oui, supprimer</Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" className="text-danger hover:text-danger sm:mr-auto" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirmDelete(true)}>
              Supprimer
            </Button>
          )
        ) : null}
        <div className="flex gap-2 sm:ml-auto">
          <Link href="/app/prestations" className="inline-flex h-10 flex-1 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface-muted hover:text-text sm:flex-none">
            Annuler
          </Link>
          <Button type="submit" loading={pending} className="flex-1 sm:flex-none">
            {initial.id ? "Enregistrer" : "Créer la prestation"}
          </Button>
        </div>
      </div>
    </form>
  );
}

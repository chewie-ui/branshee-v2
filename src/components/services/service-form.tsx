"use client";

import type { Week as OpeningWeek } from "@/lib/opening";
import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { deleteService, saveService, type ServiceFormState } from "@/server/actions/services";
import { submitKeepingValues } from "@/lib/form";
import { WeekRanges, type Week } from "@/components/schedule/week-ranges";
import { useT } from "@/components/app-locale";

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
  kind: "individual" | "group";
  capacity: number | null;
  blocksIndividual: boolean;
  /** Plages où la prestation est proposée ; vide = toutes les heures d'ouverture. */
  hours: Week;
  durationMaxMin: number | null;
  location: string;
  imageUrl: string | null;
  fee: { type: "percent" | "amount"; value: string } | null;
};

type Props = {
  initial: Initial;
  categories: { id: string; name: string }[];
  team: { id: string; name: string }[];
  showAudience: boolean;
  /** Cours collectifs autorisés (interrupteur du super-admin). */
  allowGroup?: boolean;
  /** Horaires d'ouverture : cadre des jours et heures de la prestation. */
  bounds?: OpeningWeek | null;
};

const fmt = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m / 60} h`);

export function ServiceForm({ initial, categories, team, showAudience, allowGroup = true, bounds = null }: Props) {
  const t = useT();
  const [state, action, pending] = useActionState<ServiceFormState, FormData>(saveService.bind(null, initial.id), undefined);
  const [category, setCategory] = useState(initial.categoryId);
  const [color, setColor] = useState(initial.color);
  const [everyone, setEveryone] = useState(initial.memberIds.length === 0);
  const [kind, setKind] = useState(initial.kind);
  const hasHours = Object.values(initial.hours).some((r) => r.length > 0);
  const [limited, setLimited] = useState(hasHours);
  const [hours, setHours] = useState<Week>(hasHours ? initial.hours : { 1: [{ start: "09:00", end: "12:00" }] });
  const [variable, setVariable] = useState(initial.durationMaxMin != null);
  const [image, setImage] = useState<{ url: string | null; file: File | null; removed: boolean }>({ url: initial.imageUrl, file: null, removed: false });
  const [fee, setFee] = useState(initial.fee != null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();
  const err = state?.fieldErrors ?? {};
  const durations = DURATIONS.includes(initial.durationMin) ? DURATIONS : [...DURATIONS, initial.durationMin].sort((a, b) => a - b);

  const preview = image.file ? URL.createObjectURL(image.file) : image.removed ? null : image.url;

  return (
    <form
      onSubmit={submitKeepingValues((fd) => {
        if (image.file) fd.set("image", image.file);
        else fd.delete("image");
        if (image.removed) fd.set("removeImage", "1");
        action(fd);
      })}
      className="space-y-6"
      noValidate
    >
      {state?.error ? <p className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{state.error}</p> : null}

      <Card className="space-y-5 p-5">
        <Field label="Nom" htmlFor="name" error={err.name}>
          <Input id="name" name="name" defaultValue={initial.name} placeholder={t("Ex. : Coupe homme, Séance de kiné, Rendez-vous conseil")} maxLength={80} aria-invalid={!!err.name || undefined} />
        </Field>
        <fieldset hidden={!allowGroup && initial.kind !== "group"}>
          <legend className="mb-2 text-sm font-medium">Type</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([["individual", t("Rendez-vous individuel"), t("Un client à la fois.")], ["group", t("Cours collectif"), t("Plusieurs clients sur une même séance planifiée.")]] as const).map(([v, t, d]) => (
              <label key={v} className={cn("flex cursor-pointer gap-3 rounded-xl border p-4", kind === v ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong")}>
                <input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} className="mt-0.5 size-4 accent-[var(--accent)]" />
                <span>
                  <span className="block text-sm font-semibold">{t}</span>
                  <span className="mt-0.5 block text-sm text-muted">{d}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {kind === "group" ? (
          <Field label={t("Nombre de places par séance")} htmlFor="capacity" error={err.capacity}>
            <Input id="capacity" name="capacity" type="number" min={2} max={500} defaultValue={initial.capacity ?? 8} className="sm:max-w-40" aria-invalid={!!err.capacity || undefined} />
          </Field>
        ) : null}
        {kind === "group" ? (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="blocksIndividual" defaultChecked={initial.blocksIndividual} className="mt-0.5 size-4 accent-[var(--accent)]" />
            <span>
              <span className="block font-medium">{t("Bloquer l'agenda de l'animateur")}</span>
              <span className="block text-muted">{t("Pas de rendez-vous individuel avec lui pendant une séance.")}</span>
            </span>
          </label>
        ) : null}
        <Field label={t("Description (facultatif)")} htmlFor="description" hint={t("Affichée aux clients sous le nom de la prestation.")}>
          <Textarea id="description" name="description" defaultValue={initial.description} rows={3} maxLength={500} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium">{t("Image (facultatif)")}</p>
          <div className="flex items-center gap-4">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-20 rounded-lg border border-border object-cover" />
            ) : (
              <span className="flex size-20 items-center justify-center rounded-lg border border-dashed border-border-strong text-muted"><ImageIcon className="size-6" aria-hidden="true" /></span>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover">
                <Upload className="size-4" aria-hidden="true" />
                {preview ? t("Changer l'image") : t("Ajouter une image")}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setImage({ ...image, file: f, removed: false }); }} />
              </label>
              {preview ? <button type="button" onClick={() => setImage({ url: image.url, file: null, removed: true })} className="text-left text-sm font-medium text-muted hover:text-danger">{t("Retirer")}</button> : null}
              <p className="text-xs text-muted">{t("JPG, PNG ou WebP, 5 Mo max.")}</p>
            </div>
          </div>
          {err.image ? <p className="mt-1 text-sm text-danger" role="alert">{err.image}</p> : null}
        </div>
        <Field label={t("Lieu (facultatif)")} htmlFor="location" hint={t("Si différent de votre adresse habituelle (ex. salle louée pour un cours).")}>
          <Input id="location" name="location" defaultValue={initial.location} maxLength={200} placeholder={t("Laissez vide pour utiliser votre adresse")} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Field label={variable ? t("Durée (de…)") : "Durée"} htmlFor="durationMin" error={err.durationMin}>
              <Select id="durationMin" name="durationMin" defaultValue={String(initial.durationMin)}>
                {durations.map((d) => (
                  <option key={d} value={d}>{fmt(d)}</option>
                ))}
              </Select>
            </Field>
            {kind === "individual" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={variable} onChange={(e) => setVariable(e.target.checked)} className="size-4 accent-[var(--accent)]" />
                {t("Durée variable (ex. 30 à 45 min)")}
              </label>
            ) : null}
          </div>
          {variable && kind === "individual" ? (
            <Field label={t("…à (durée maximale)")} htmlFor="durationMaxMin" error={err.durationMaxMin} hint="Affichée au client ; l'agenda bloque la durée maximale.">
              <Select id="durationMaxMin" name="durationMaxMin" defaultValue={String(initial.durationMaxMin ?? 45)}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>{fmt(d)}</option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label={t("Prix (facultatif)")} htmlFor="price" error={err.price} hint={t("Laisser vide pour ne pas afficher de prix.")}>
            <div className="relative">
              <Input id="price" name="price" inputMode="decimal" defaultValue={initial.price} placeholder="45" className="pr-9" aria-invalid={!!err.price || undefined} />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">€</span>
            </div>
          </Field>
          <Field label="Catégorie" htmlFor="categoryId">
            <Select id="categoryId" name="categoryId" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{t("Sans catégorie")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new">{t("+ Nouvelle catégorie…")}</option>
            </Select>
          </Field>
          {category === "__new" ? (
            <Field label={t("Nom de la catégorie")} htmlFor="newCategory">
              <Input id="newCategory" name="newCategory" maxLength={50} autoFocus />
            </Field>
          ) : null}
        </div>
        <fieldset data-tour="service-color">
          <legend className="mb-2 text-sm font-medium">{t("Couleur dans l'agenda")}</legend>
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
        {/* Cours collectif : l'animateur se choisit séance par séance. */}
        <fieldset hidden={kind === "group"}>
          <legend className="mb-2 text-sm font-medium">{t("Qui réalise cette prestation ?")}</legend>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            {t("Toute l'équipe")}
          </label>
          {!everyone ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
          <Field label={t("Proposée à")} htmlFor="audience" hint={t("Selon la réponse à la question « première visite ? » posée avant la réservation.")}>
            <Select id="audience" name="audience" defaultValue={initial.audience}>
              <option value="all">{t("Tous les clients")}</option>
              <option value="new">{t("Nouveaux clients uniquement")}</option>
              <option value="existing">{t("Clients déjà venus uniquement")}</option>
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="audience" value={initial.audience} />
        )}

        <div className="space-y-3">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="feeEnabled" checked={fee} onChange={(e) => setFee(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
            <span>
              <span className="font-medium">{t("Frais d'annulation propres à cette prestation")}</span>
              <span className="block text-muted">{t("Remplacent le pourcentage de votre politique d'annulation, en cas d'annulation tardive ou d'absence non excusée.")}</span>
            </span>
          </label>
          {fee ? (
            <div className="flex flex-wrap items-start gap-3 pl-7">
              <Select name="feeType" defaultValue={initial.fee?.type ?? "percent"} className="w-auto" aria-label={t("Type de frais")}>
                <option value="percent">{t("Pourcentage du prix")}</option>
                <option value="amount">{t("Montant fixe")}</option>
              </Select>
              <Field label="" htmlFor="feeValue" error={err.feeValue}>
                <Input id="feeValue" name="feeValue" inputMode="decimal" defaultValue={initial.fee?.value ?? ""} placeholder="30" className="w-28" aria-label={t("Valeur des frais")} aria-invalid={!!err.feeValue || undefined} />
              </Field>
            </div>
          ) : null}
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={initial.isActive} className="mt-0.5 size-4 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">{t("Réservable en ligne")}</span>
            <span className="block text-muted">{t("Décochez pour la masquer de votre page sans la supprimer.")}</span>
          </span>
        </label>
      </Card>

      {kind === "individual" ? (
        <Card className="overflow-hidden">
          {/* Padding sur un conteneur : sur un <fieldset>, la légende se colle au bord supérieur. */}
          <div className="p-5">
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-medium">{t("Quand cette prestation est-elle proposée ?")}</legend>
            <input type="hidden" name="hours" value={limited ? JSON.stringify(hours) : "{}"} />
            {([[false, t("Pendant toutes les heures d'ouverture")], [true, t("Seulement certains jours ou à certaines heures")]] as const).map(([v, label]) => (
              <label key={String(v)} className="flex items-center gap-3 text-sm">
                <input type="radio" name="hoursMode" checked={limited === v} onChange={() => setLimited(v)} className="size-4 accent-[var(--accent)]" />
                {label}
              </label>
            ))}
            {limited ? <p className="text-sm text-muted">{t("Exemple : uniquement le mardi de 8 h à 13 h. Les créneaux restent limités aux horaires du praticien.")}</p> : null}
          </fieldset>
          </div>
          {limited ? <WeekRanges value={hours} onChange={setHours} offLabel={t("Non proposée")} defaultRange={{ start: "09:00", end: "12:00" }} bounds={bounds} className="border-t border-border" /> : null}
          {err.hours ? <p className="px-5 pb-4 text-sm text-danger" role="alert">{err.hours}</p> : null}
        </Card>
      ) : null}

      <p className="text-sm text-muted">
        Pour ne proposer cette prestation qu&apos;à certains clients (ex. femmes enceintes), utilisez les{" "}
        <Link href="/app/prestations/questions" className="font-medium text-accent hover:text-accent-hover">{t("questions avant réservation")}</Link>.
      </p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        {initial.id ? (
          confirmDelete ? (
            <div className="flex items-center gap-2 sm:mr-auto">
              <span className="text-sm text-danger">{t("Supprimer définitivement ?")}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>Non</Button>
              <Button type="button" variant="danger" size="sm" loading={deleting} onClick={() => startDelete(async () => void (await deleteService(initial.id!)))}>{t("Oui, supprimer")}</Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" className="text-danger hover:text-danger sm:mr-auto" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirmDelete(true)}>
              Supprimer
            </Button>
          )
        ) : null}
        <div className="flex gap-2 sm:ml-auto">
          <Link href="/app/prestations" className="inline-flex h-10 flex-1 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface-muted hover:text-text sm:flex-none">
            {t("Annuler")}
          </Link>
          <Button type="submit" loading={pending} className="flex-1 sm:flex-none">
            {initial.id ? t("Enregistrer") : t("Créer la prestation")}
          </Button>
        </div>
      </div>
    </form>
  );
}

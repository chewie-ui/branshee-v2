"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { saveEpisode } from "@/server/actions/physio";

export type EpisodeRow = { id: string; title: string; kind: string; kindLabel: string; prescriptionDate: string | null; prescriber: string | null; done: number; prescribed: number | null; status: string; approvalEnd: string | null };
export type EpisodeForm = { title: string; prescriberName: string; prescriberInami: string; prescriptionDate: string; sessionsPrescribed: string; pathologyKind: string; nomenclature: string; approvalStart: string; approvalEnd: string };

const KINDS = [
  ["courante", "Pathologie courante"],
  ["E", "Pathologie lourde (liste E)"],
  ["Fa", "Liste Fa"],
  ["Fb", "Liste Fb"],
  ["autre", "Autre situation"],
] as const;
const day = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

/** Formulaire d'un épisode de soins (prescription) : création ou modification. */
export function EpisodeEditor({ customerId, episodeId, initial, onDone }: { customerId: string; episodeId: string | null; initial: EpisodeForm; onDone?: (id: string) => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [kind, setKind] = useState(initial.pathologyKind || "courante");
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(e.currentTarget));
        setMsg(null);
        start(async () => {
          const r = await saveEpisode(customerId, episodeId, fd);
          if (r.ok) onDone?.(r.id!);
          else setMsg(r.error);
        });
      }}
    >
      <Field label="Intitulé" htmlFor="ep-title">
        <Input id="ep-title" name="title" defaultValue={initial.title} required maxLength={120} placeholder="Ex. Entorse cheville droite, lombalgie chronique…" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Date de la prescription" htmlFor="ep-date">
          <Input id="ep-date" name="prescriptionDate" type="date" defaultValue={initial.prescriptionDate} />
        </Field>
        <Field label="Séances prescrites" htmlFor="ep-n">
          <Input id="ep-n" name="sessionsPrescribed" type="number" min={1} max={500} defaultValue={initial.sessionsPrescribed} />
        </Field>
        <Field label="Situation" htmlFor="ep-kind">
          <Select id="ep-kind" name="pathologyKind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Prescripteur" htmlFor="ep-presc">
          <Input id="ep-presc" name="prescriberName" defaultValue={initial.prescriberName} maxLength={120} />
        </Field>
        <Field label="N° INAMI prescripteur" htmlFor="ep-presci">
          <Input id="ep-presci" name="prescriberInami" defaultValue={initial.prescriberInami} maxLength={20} inputMode="numeric" />
        </Field>
        <Field label="Code de nomenclature (facultatif)" htmlFor="ep-nom">
          <Input id="ep-nom" name="nomenclature" defaultValue={initial.nomenclature} maxLength={60} />
        </Field>
        {kind !== "courante" ? (
          <>
            <Field label="Accord / notification : début" htmlFor="ep-as">
              <Input id="ep-as" name="approvalStart" type="date" defaultValue={initial.approvalStart} />
            </Field>
            <Field label="Accord / notification : fin" htmlFor="ep-ae">
              <Input id="ep-ae" name="approvalEnd" type="date" defaultValue={initial.approvalEnd} />
            </Field>
          </>
        ) : null}
      </div>
      {msg ? <p className="text-sm text-danger" role="alert">{msg}</p> : null}
      <Button type="submit" loading={pending}>{episodeId ? "Enregistrer" : "Créer l'épisode"}</Button>
    </form>
  );
}

/** Liste des épisodes de soins d'un patient, avec le compteur de séances. */
export function EpisodesList({ customerId, rows, canManage, defaults }: { customerId: string; rows: EpisodeRow[]; canManage: boolean; defaults: EpisodeForm }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader title="Épisodes de soins" description="Une prescription = un épisode : dossier structuré (anamnèse, examen, plan, évaluations, clôture) et compteur de séances." action={canManage && !open ? <Button size="sm" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setOpen(true)}>Nouvel épisode</Button> : null} />
      {open ? (
        <div className="border-b border-border p-5 pt-0">
          <EpisodeEditor customerId={customerId} episodeId={null} initial={defaults} onDone={(id) => router.push(`/app/clients/${customerId}/episodes/${id}`)} />
        </div>
      ) : null}
      {rows.length === 0 && !open ? (
        <p className="flex items-center gap-2 px-5 pb-5 text-sm text-muted"><ClipboardList className="size-4" aria-hidden="true" />Aucun épisode pour l&apos;instant.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((e) => {
            const over = e.prescribed != null && e.done > e.prescribed;
            return (
              <li key={e.id}>
                <Link href={`/app/clients/${customerId}/episodes/${e.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="text-muted">
                      {e.kindLabel}
                      {e.prescriptionDate ? ` · prescrit le ${day(e.prescriptionDate)}` : ""}
                      {e.prescriber ? ` · ${e.prescriber}` : ""}
                      {e.approvalEnd ? ` · accord jusqu'au ${day(e.approvalEnd)}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${over ? "bg-danger-soft text-danger" : "bg-surface-muted text-text"}`}>{e.done}{e.prescribed != null ? ` / ${e.prescribed}` : ""} séance{e.done > 1 ? "s" : ""}</span>
                  {e.status === "closed" ? <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-muted">Clôturé</span> : null}
                  <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

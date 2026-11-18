"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Ruler, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { MEASURES, measureDef } from "@/lib/care-measures";
import { addCareMeasure, deleteCareMeasure } from "@/server/actions/physio";

export type MeasureView = { id: string; key: string; label: string; value: string; unit: string; side: string; date: string; author: string; deleted: string | null };
const day = (iso: string) => iso.split("-").reverse().join("/");

/** Mesures de l'examen et du suivi : tableau d'évolution par paramètre (une colonne par date). */
export function CareMeasures({ episodeId, measures, canManage, today }: { episodeId: string; measures: MeasureView[]; canManage: boolean; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState<string>("eva");
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [pending, start] = useTransition();
  const def = measureDef(key)!;
  const live = measures.filter((m) => !m.deleted);
  const rows = [...new Map(live.map((m) => [`${m.label}|${m.side}|${m.unit}`, { label: m.label, side: m.side, unit: m.unit }])).values()];
  const dates = [...new Set(live.map((m) => m.date))].sort();
  return (
    <Card id="mesures">
      <CardHeader title="Mesures" description="EVA, amplitudes, force, périmètres, tests : l'évolution se lit d'une date à l'autre." action={canManage && !open ? <Button size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setOpen(true)}>Ajouter</Button> : null} />
      {open ? (
        <form
          className="space-y-4 border-b border-border p-5 pt-0"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = Object.fromEntries(new FormData(e.currentTarget));
            setError(null);
            start(async () => {
              const r = await addCareMeasure(episodeId, fd);
              if (r.ok) {
                (e.target as HTMLFormElement).reset();
                setKey("eva");
                setOpen(false);
                router.refresh();
              } else setError(r.error);
            });
          }}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Paramètre" htmlFor="m-key" className="col-span-2">
              <Select id="m-key" name="measureKey" value={key} onChange={(e) => setKey(e.target.value)}>{MEASURES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</Select>
            </Field>
            <Field label={key === "autre" ? "Nom de la mesure" : "Précision (facultatif)"} htmlFor="m-detail" className="col-span-2">
              <Input id="m-detail" name="detail" maxLength={80} required={key === "autre"} placeholder={key === "rom" ? "Flexion genou" : key === "perimetre" ? "Mollet, 10 cm sous la rotule" : ""} />
            </Field>
            <Field label={`Valeur${def.unit ? ` (${def.unit})` : ""}`} htmlFor="m-value">
              <Input id="m-value" name="value" required maxLength={20} inputMode="decimal" />
            </Field>
            {key === "autre" ? <Field label="Unité" htmlFor="m-unit"><Input id="m-unit" name="unit" maxLength={12} /></Field> : null}
            {def.sided ? (
              <Field label="Côté" htmlFor="m-side">
                <Select id="m-side" name="side" defaultValue=""><option value="">—</option><option value="G">Gauche</option><option value="D">Droit</option></Select>
              </Field>
            ) : null}
            <Field label="Date" htmlFor="m-date"><Input id="m-date" name="date" type="date" defaultValue={today} required /></Field>
          </div>
          {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={pending}>Enregistrer</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          </div>
        </form>
      ) : null}
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 px-5 pb-5 text-sm text-muted"><Ruler className="size-4" aria-hidden="true" />Aucune mesure pour l&apos;instant.</p>
      ) : (
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Paramètre</th>
                {dates.map((d) => <th key={d} scope="col" className="px-3 py-2 text-right font-medium tabular-nums">{day(d)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.label}|${r.side}|${r.unit}`} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">{r.label}{r.side ? ` (${r.side === "G" ? "gauche" : "droit"})` : ""}</th>
                  {dates.map((d) => {
                    const cell = live.filter((m) => m.date === d && m.label === r.label && m.side === r.side && m.unit === r.unit);
                    return (
                      <td key={d} className="px-3 py-2 text-right tabular-nums">
                        {cell.map((m) => (
                          <span key={m.id} className="inline-flex items-center gap-1">
                            {m.value}{m.unit && !m.unit.startsWith("/") ? ` ${m.unit}` : m.unit}
                            {canManage ? <button type="button" disabled={pending} className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Supprimer ${r.label} du ${day(d)}`} onClick={() => start(async () => { await deleteCareMeasure(episodeId, m.id); router.refresh(); })}><Trash2 className="size-3.5" aria-hidden="true" /></button> : null}
                          </span>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {measures.some((m) => m.deleted) ? (
        <div className="px-5 pb-5 text-sm">
          <button type="button" className="font-medium text-accent hover:text-accent-hover" onClick={() => setShowDeleted((v) => !v)}>{showDeleted ? "Masquer" : "Voir"} les mesures supprimées</button>
          {showDeleted ? <ul className="mt-2 space-y-1 text-muted">{measures.filter((m) => m.deleted).map((m) => <li key={m.id}>{day(m.date)} · {m.label} : {m.value}{m.unit} · saisie par {m.author}, {m.deleted}</li>)}</ul> : null}
        </div>
      ) : null}
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { saveBookingRules } from "@/server/actions/settings";
import { Section, SettingsForm, Toggle } from "./settings-form";

type R = {
  slotMode: "fixed" | "interval";
  slotIntervalMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minLeadMin: number | null;
  horizonDays: number | null;
  autoConfirm: boolean;
  phoneRequired: boolean;
  firstVisitQuestion: { enabled: boolean; question: string; newLabel: string; existingLabel: string };
};

const LEADS = [
  { v: "none", l: "Aucun" },
  { v: "30", l: "30 minutes" },
  { v: "60", l: "1 heure" },
  { v: "120", l: "2 heures" },
  { v: "240", l: "4 heures" },
  { v: "720", l: "12 heures" },
  { v: "1440", l: "24 heures" },
  { v: "2880", l: "48 heures" },
];
const HORIZONS = [
  { v: "none", l: "Sans limite" },
  { v: "7", l: "1 semaine" },
  { v: "14", l: "2 semaines" },
  { v: "30", l: "1 mois" },
  { v: "60", l: "2 mois" },
  { v: "90", l: "3 mois" },
  { v: "180", l: "6 mois" },
  { v: "365", l: "1 an" },
];
const BUFFERS = [0, 5, 10, 15, 20, 30, 45, 60];

export function RulesForm({ r }: { r: R }) {
  const [mode, setMode] = useState(r.slotMode);
  const [fv, setFv] = useState(r.firstVisitQuestion.enabled);
  const pick = (list: { v: string }[], value: number | null) => (value == null ? "none" : list.some((x) => x.v === String(value)) ? String(value) : list[0]!.v);

  return (
    <SettingsForm action={saveBookingRules}>
      {(err) => (
        <>
          <Section title="Créneaux proposés">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Heures de début</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { v: "fixed", t: "À la suite", d: "Les créneaux s'enchaînent selon la durée de la prestation (9:00, 9:45, 10:30…)." },
                  { v: "interval", t: "À intervalle régulier", d: "Un départ possible toutes les N minutes, quelle que soit la durée." },
                ].map((o) => (
                  <label key={o.v} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${mode === o.v ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong"}`}>
                    <input type="radio" name="slotMode" value={o.v} checked={mode === o.v} onChange={() => setMode(o.v as R["slotMode"])} className="mt-0.5 size-4 accent-[var(--accent)]" />
                    <span>
                      <span className="block text-sm font-semibold">{o.t}</span>
                      <span className="mt-0.5 block text-sm text-muted">{o.d}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {mode === "interval" ? (
              <Field label="Un départ toutes les" htmlFor="slotIntervalMin">
                <Select id="slotIntervalMin" name="slotIntervalMin" defaultValue={String(r.slotIntervalMin)} className="sm:max-w-xs">
                  {[5, 10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </Select>
              </Field>
            ) : (
              <input type="hidden" name="slotIntervalMin" value={r.slotIntervalMin} />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Temps de battement avant" htmlFor="bufferBeforeMin" hint="Préparation avant chaque RDV.">
                <Select id="bufferBeforeMin" name="bufferBeforeMin" defaultValue={String(r.bufferBeforeMin)}>
                  {BUFFERS.map((m) => <option key={m} value={m}>{m ? `${m} min` : "Aucun"}</option>)}
                </Select>
              </Field>
              <Field label="Temps de battement après" htmlFor="bufferAfterMin" hint="Rangement, désinfection, notes…">
                <Select id="bufferAfterMin" name="bufferAfterMin" defaultValue={String(r.bufferAfterMin)}>
                  {BUFFERS.map((m) => <option key={m} value={m}>{m ? `${m} min` : "Aucun"}</option>)}
                </Select>
              </Field>
            </div>
          </Section>

          <Section title="Quand peut-on réserver ?" description="S'applique uniquement aux réservations en ligne.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Délai minimum avant un RDV" htmlFor="minLeadMin" error={err.minLeadMin}>
                <Select id="minLeadMin" name="minLeadMin" defaultValue={pick(LEADS, r.minLeadMin)}>
                  {LEADS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </Select>
              </Field>
              <Field label="Réservable jusqu'à" htmlFor="horizonDays" error={err.horizonDays}>
                <Select id="horizonDays" name="horizonDays" defaultValue={pick(HORIZONS, r.horizonDays)}>
                  {HORIZONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </Select>
              </Field>
            </div>
            <Toggle name="autoConfirm" defaultChecked={r.autoConfirm} label="Confirmer automatiquement les réservations" description="Décoché : chaque réservation arrive en « demande à valider »." />
            <Toggle name="phoneRequired" defaultChecked={r.phoneRequired} label="Téléphone obligatoire" description="Le client doit laisser un numéro pour réserver." />
          </Section>

          <Section title="Question « première visite ? »" description="Permet de proposer certaines prestations aux nouveaux clients seulement (ex. bilan initial).">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="fvEnabled" checked={fv} onChange={(e) => setFv(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span className="font-medium">Poser la question avant le choix de la prestation</span>
            </label>
            <div className={fv ? "space-y-4" : "hidden"}>
              <Field label="Question" htmlFor="fvQuestion" error={err.fvQuestion}>
                <Input id="fvQuestion" name="fvQuestion" defaultValue={r.firstVisitQuestion.question} maxLength={140} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Réponse « nouveau client »" htmlFor="fvNew">
                  <Input id="fvNew" name="fvNew" defaultValue={r.firstVisitQuestion.newLabel} maxLength={60} />
                </Field>
                <Field label="Réponse « déjà venu »" htmlFor="fvExisting">
                  <Input id="fvExisting" name="fvExisting" defaultValue={r.firstVisitQuestion.existingLabel} maxLength={60} />
                </Field>
              </div>
            </div>
          </Section>
        </>
      )}
    </SettingsForm>
  );
}

"use client";

import { useState, useTransition } from "react";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { cancelAppointment, saveInternalNote, setNoShow } from "@/server/actions/appointments";

export function CancelAppointmentButton({ id, isBlock }: { id: string; isBlock: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirm) {
    return (
      <Button variant="secondary" className="text-danger hover:text-danger" icon={<XCircle className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>
        {isBlock ? "Supprimer le blocage" : "Annuler le rendez-vous"}
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-danger/30 bg-danger-soft p-3">
      <p className="text-sm text-danger">{isBlock ? "Libérer ce créneau ?" : "Annuler ce rendez-vous ? Le client est prévenu par email."}</p>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={pending}>Non</Button>
        <Button variant="danger" size="sm" loading={pending} onClick={() => start(async () => { const r = await cancelAppointment(id); if (!r.ok) setError(r.error ?? "Erreur."); })}>Oui, annuler</Button>
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    </div>
  );
}

export function NoShowControl({ id, noShow, reason }: { id: string; noShow: boolean; reason: "justified" | "unjustified" | null }) {
  const [pending, start] = useTransition();
  const set = (v: boolean, r: "justified" | "unjustified" | null) => start(async () => void (await setNoShow(id, v, r)));
  return (
    <fieldset disabled={pending} className="space-y-2">
      <legend className="text-sm font-medium">Présence</legend>
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Venu", active: !noShow, onClick: () => set(false, null) },
          { label: "Absent excusé", active: noShow && reason === "justified", onClick: () => set(true, "justified") },
          { label: "Absent non excusé", active: noShow && reason !== "justified", onClick: () => set(true, "unjustified") },
        ].map((o) => (
          <button key={o.label} type="button" onClick={o.onClick} aria-pressed={o.active} className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${o.active ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border-strong bg-surface text-muted hover:text-text"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function InternalNote({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <label htmlFor="internalNote" className="text-sm font-medium">Note interne</label>
      <Textarea id="internalNote" value={value} onChange={(e) => setValue(e.target.value)} rows={3} maxLength={2000} placeholder="Visible uniquement par l'équipe" />
      {value !== saved ? (
        <div className="flex justify-end">
          <Button size="sm" loading={pending} onClick={() => start(async () => { await saveInternalNote(id, value); setSaved(value); })}>Enregistrer la note</Button>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { submitKeepingValues } from "@/lib/form";
import { cancelSession, createSessions, type SessionFormState } from "@/server/actions/group-sessions";

export function NewSessionForm({ serviceId, team, capacity, defaultDate }: { serviceId: string; team: { id: string; name: string }[]; capacity: number | null; defaultDate: string }) {
  const [state, action, pending] = useActionState<SessionFormState, FormData>(createSessions.bind(null, serviceId), undefined);
  const [repeat, setRepeat] = useState(false);
  const err = state?.fieldErrors ?? {};
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date" htmlFor="date" error={err.date}>
          <Input id="date" name="date" type="date" required defaultValue={defaultDate} min={defaultDate} aria-invalid={!!err.date || undefined} />
        </Field>
        <Field label="Heure" htmlFor="time" error={err.time}>
          <Input id="time" name="time" type="time" required defaultValue="18:00" step={300} aria-invalid={!!err.time || undefined} />
        </Field>
        <Field label="Places" htmlFor="capacity" error={err.capacity}>
          <Input id="capacity" name="capacity" type="number" min={1} max={500} defaultValue={capacity ?? ""} aria-invalid={!!err.capacity || undefined} />
        </Field>
      </div>
      {team.length > 0 ? (
        <Field label="Animé par" htmlFor="memberId" hint="Ses rendez-vous individuels sont bloqués pendant la séance." error={err.memberId}>
          <Select id="memberId" name="memberId" defaultValue={team.length === 1 ? team[0]!.id : ""}>
            <option value="">Personne en particulier</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </Field>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="repeat" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Répéter chaque semaine
        </label>
        {repeat ? (
          <label className="flex items-center gap-2 text-sm">
            pendant
            <Input name="repeatWeeks" type="number" min={2} max={52} defaultValue={10} className="h-9 w-20" aria-label="Nombre de semaines" />
            semaines
          </label>
        ) : null}
      </div>
      {state?.error ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-success" role="status">{state.message}</p> : null}
      <Button type="submit" loading={pending} icon={<CalendarPlus className="size-4" aria-hidden="true" />}>
        Planifier
      </Button>
    </form>
  );
}

export function CancelSessionButton({ id, booked }: { id: string; booked: number }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirm) {
    return (
      <Button variant="secondary" className="text-danger hover:text-danger" icon={<XCircle className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>
        Annuler la séance
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-danger/30 bg-danger-soft p-3">
      <p className="text-sm text-danger">{booked > 0 ? `Annuler la séance ? Les ${booked} participant${booked > 1 ? "s sont prévenus" : " est prévenu"} par email.` : "Annuler cette séance ?"}</p>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={pending}>Non</Button>
        <Button variant="danger" size="sm" loading={pending} onClick={() => start(async () => { const r = await cancelSession(id); if (!r.ok) setError(r.error ?? "Erreur."); })}>Oui, annuler</Button>
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    </div>
  );
}

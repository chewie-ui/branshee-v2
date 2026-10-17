"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarPlus, Repeat, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { submitKeepingValues } from "@/lib/form";
import { hhmmOf, minutesOf, parseQuickTime } from "@/lib/time-input";
import { cancelSession, createSessions, restoreSession, saveRecurrence, type SessionFormState } from "@/server/actions/group-sessions";

const DAYS = [[1, "Lun"], [2, "Mar"], [3, "Mer"], [4, "Jeu"], [5, "Ven"], [6, "Sam"], [0, "Dim"]] as const;

/** Cours récurrent : jours de la semaine + heure, sans date de fin. */
export function RecurrenceForm({ serviceId, initial }: { serviceId: string; initial: { weekdays: number[]; startTime: string } | null }) {
  const [days, setDays] = useState<number[]>(initial?.weekdays ?? []);
  const [time, setTime] = useState(initial?.startTime ?? "18:00");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const toggle = (d: number) => setDays((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d]));
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">Jours</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Jours du cours">
          {DAYS.map(([d, l]) => (
            <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => toggle(d)} className={cn("h-10 w-12 rounded-lg border text-sm font-medium", days.includes(d) ? "border-accent bg-accent text-accent-foreground" : "border-border-strong bg-surface text-muted hover:text-text")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <Field label="Heure" htmlFor="rec-time" hint="Ex. 18 ou 18h30">
        <Input id="rec-time" value={time} onChange={(e) => setTime(e.target.value)} onBlur={() => setTime(parseQuickTime(time) ?? time)} className="w-28" inputMode="numeric" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button loading={pending} icon={<Repeat className="size-4" aria-hidden="true" />} onClick={() => start(async () => { const r = await saveRecurrence(serviceId, { weekdays: days, startTime: time }); setMsg(r.ok ? { ok: true, text: days.length ? "Récurrence enregistrée." : "Récurrence arrêtée." } : { ok: false, text: r.error ?? "Erreur." }); })}>
          {days.length ? "Enregistrer la récurrence" : initial ? "Arrêter la récurrence" : "Enregistrer"}
        </Button>
        {msg ? <span className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role="status">{msg.text}</span> : null}
      </div>
    </div>
  );
}

export function NewSessionForm({ serviceId, team, capacity, durationMin, defaultDate }: { serviceId: string; team: { id: string; name: string }[]; capacity: number | null; durationMin: number; defaultDate: string }) {
  const [state, action, pending] = useActionState<SessionFormState, FormData>(createSessions.bind(null, serviceId), undefined);
  const [repeat, setRepeat] = useState(false);
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState(hhmmOf(Math.min(minutesOf("18:00") + durationMin, 1439)));
  const err = state?.fieldErrors ?? {};
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Date" htmlFor="date" error={err.date} className="sm:col-span-2">
          <Input id="date" name="date" type="date" required defaultValue={defaultDate} min={defaultDate} aria-invalid={!!err.date || undefined} />
        </Field>
        <Field label="Début" htmlFor="start" error={err.start}>
          <Input
            id="start"
            name="start"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            onBlur={() => {
              const p = parseQuickTime(start);
              if (p) { setStart(p); setEnd(hhmmOf(Math.min(minutesOf(p) + durationMin, 1439))); }
            }}
            inputMode="numeric"
            aria-invalid={!!err.start || undefined}
          />
        </Field>
        <Field label="Fin" htmlFor="end" error={err.end}>
          <Input id="end" name="end" value={end} onChange={(e) => setEnd(e.target.value)} onBlur={() => setEnd(parseQuickTime(end) ?? end)} inputMode="numeric" aria-invalid={!!err.end || undefined} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Places" htmlFor="capacity" error={err.capacity}>
          <Input id="capacity" name="capacity" type="number" min={1} max={500} defaultValue={capacity ?? ""} aria-invalid={!!err.capacity || undefined} />
        </Field>
        {team.length > 0 ? (
          <Field label="Animé par" htmlFor="memberId" hint="Ses rendez-vous individuels sont bloqués pendant la séance (si l'option est active).">
            <Select id="memberId" name="memberId" defaultValue={team.length === 1 ? team[0]!.id : ""}>
              <option value="">Membres assignés au cours</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>
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
        Ajouter la date
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
        Annuler cette séance
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-danger/30 bg-danger-soft p-3">
      <p className="text-sm text-danger">{booked > 0 ? `Annuler la séance ? ${booked > 1 ? `Les ${booked} participants sont prévenus` : "Le participant est prévenu"} par email.` : "Annuler cette séance ? Personne ne pourra s'y inscrire."}</p>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={pending}>Non</Button>
        <Button variant="danger" size="sm" loading={pending} onClick={() => start(async () => { const r = await cancelSession(id); if (!r.ok) setError(r.error ?? "Erreur."); })}>Oui, annuler</Button>
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    </div>
  );
}

export function RestoreSessionButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" loading={pending} icon={<RotateCcw className="size-4" aria-hidden="true" />} onClick={() => start(async () => void (await restoreSession(id)))}>
      Rétablir la séance
    </Button>
  );
}

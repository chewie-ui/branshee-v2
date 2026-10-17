"use client";

import { useState, useTransition } from "react";
import { CalendarOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { addException, deleteException } from "@/server/actions/schedule";

export type ExceptionRow = { id: string; date: string; label: string; who: string; isClosed: boolean; hours: string | null; reason: string | null; canDelete: boolean };

export function ExceptionForm({ targets, today }: { targets: { value: string; label: string }[]; today: string }) {
  const [type, setType] = useState<"closed" | "hours">("closed");
  // Plusieurs personnes à la fois (ex. formation de deux kinés) ; « Tout l'établissement » est exclusif.
  const [who, setWho] = useState<string[]>([targets[0]?.value ?? ""]);
  const toggleWho = (v: string) =>
    setWho((cur) => (v === "" ? [""] : cur.includes(v) ? (cur.filter((x) => x !== v).length ? cur.filter((x) => x !== v) : cur) : [...cur.filter((x) => x !== ""), v]));
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    setOk(false);
    const input = Object.fromEntries(["from", "to", "type", "start", "end", "reason"].map((k) => [k, String(formData.get(k) ?? "")]));
    input.memberIds = who.join(",");
    if (!input.to) input.to = input.from!;
    start(async () => {
      const res = await addException(input);
      if (res.ok) setOk(true);
      else setError(res.error);
    });
  }

  return (
    <form action={submit} className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {targets.length > 1 ? (
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">Pour qui</legend>
            <div className="flex flex-wrap gap-2">
              {targets.map((t) => (
                <button key={t.value || "all"} type="button" aria-pressed={who.includes(t.value)} onClick={() => toggleWho(t.value)} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${who.includes(t.value) ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border bg-surface text-muted hover:text-text"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
        <Field label="Type" htmlFor="ex-type">
          <Select id="ex-type" name="type" value={type} onChange={(e) => setType(e.target.value as "closed" | "hours")}>
            <option value="closed">Fermé / congé</option>
            <option value="hours">Horaires spéciaux</option>
          </Select>
        </Field>
        <Field label="Du" htmlFor="ex-from">
          <Input id="ex-from" name="from" type="date" min={today} defaultValue={today} required />
        </Field>
        <Field label="Au" htmlFor="ex-to" hint="Laisser vide pour un seul jour.">
          <Input id="ex-to" name="to" type="date" min={today} />
        </Field>
        {type === "hours" ? (
          <>
            <Field label="Ouvert de" htmlFor="ex-start">
              <Input id="ex-start" name="start" type="time" step={300} defaultValue="09:00" />
            </Field>
            <Field label="à" htmlFor="ex-end">
              <Input id="ex-end" name="end" type="time" step={300} defaultValue="13:00" />
            </Field>
          </>
        ) : null}
        <Field label="Motif" htmlFor="ex-reason" hint="Facultatif, visible uniquement par l'équipe." className="sm:col-span-2">
          <Input id="ex-reason" name="reason" placeholder="Vacances, formation, jour férié…" maxLength={120} />
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {error ? <p className="text-sm text-danger sm:mr-auto" role="alert">{error}</p> : ok ? <p className="text-sm text-success sm:mr-auto" role="status">Ajouté.</p> : null}
        <Button type="submit" loading={pending}>
          Ajouter
        </Button>
      </div>
    </form>
  );
}

export function ExceptionList({ rows }: { rows: ExceptionRow[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();
  if (rows.length === 0) {
    return <EmptyState icon={<CalendarOff />} title="Aucun congé ni fermeture prévu" description="Ajoutez vos vacances, jours fériés ou horaires exceptionnels : les créneaux concernés ne seront plus proposés." />;
  }
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-4 px-5 py-3">
          <div className="w-28 shrink-0 text-sm font-medium">{r.label}</div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              {r.isClosed ? <Badge tone="danger">Fermé</Badge> : <Badge tone="warning">{r.hours}</Badge>}
              <span className="text-muted">{r.who}</span>
            </p>
            {r.reason ? <p className="mt-0.5 truncate text-muted">{r.reason}</p> : null}
          </div>
          {r.canDelete ? (
            <button
              type="button"
              disabled={pendingId === r.id}
              onClick={() => {
                setPendingId(r.id);
                start(async () => {
                  await deleteException(r.id);
                  setPendingId(null);
                });
              }}
              className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger disabled:opacity-50"
              aria-label={`Supprimer l'exception du ${r.label}`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

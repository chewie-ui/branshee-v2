"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { colorClass, fmtMinutes, parseDuration } from "@/lib/projects";
import { deleteTime, logTime } from "@/server/actions/projects";

type ProjectOpt = { id: string; name: string; tasks: { id: string; title: string }[] };
type Entry = { id: string; day: string; minutes: number; note: string | null; projectId: string; projectName: string; color: string; taskTitle: string | null; billed: boolean };

/** Saisie rapide du temps (tous projets) et liste de la semaine. */
export function Timesheet({ projects, entries, today, defaultDay }: { projects: ProjectOpt[]; entries: Entry[]; today: string; defaultDay: string }) {
  const router = useRouter();
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", taskId: "", day: defaultDay, duration: "", note: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const tasks = projects.find((p) => p.id === f.projectId)?.tasks ?? [];
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const r: { ok: boolean; message?: string; error?: string } = await fn().catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion." }));
      setMsg(r.ok ? { ok: true, text: r.message ?? "Enregistré." } : { ok: false, text: r.error ?? "Action impossible." });
      if (r.ok) after?.();
      router.refresh();
    });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = parseDuration(f.duration);
    if (!minutes) return setMsg({ ok: false, text: "Durée non comprise : écrivez par exemple 1h30, 45 ou 2,5." });
    run(() => logTime({ projectId: f.projectId, taskId: f.taskId, day: f.day, minutes, note: f.note, billable: true }), () => setF((s) => ({ ...s, duration: "", note: "" })));
  };
  if (!projects.length) return <Card className="p-8 text-center text-sm text-muted">Aucun projet en cours. <Link href="/app/projets" className="font-medium text-accent hover:text-accent-hover">Créer un projet</Link></Card>;
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_150px_110px_1fr_auto] lg:items-end" noValidate>
          <Field label="Projet" htmlFor="ts-p"><Select id="ts-p" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value, taskId: "" })}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Tâche" htmlFor="ts-t"><Select id="ts-t" value={f.taskId} onChange={(e) => setF({ ...f, taskId: e.target.value })}><option value="">Sans tâche précise</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select></Field>
          <Field label="Jour" htmlFor="ts-d"><Input id="ts-d" type="date" max={today} value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} /></Field>
          <Field label="Durée" htmlFor="ts-m"><Input id="ts-m" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} placeholder="1h30" /></Field>
          <Field label="Note" htmlFor="ts-n"><Input id="ts-n" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} /></Field>
          <Button type="submit" loading={pending} icon={<Plus className="size-4" aria-hidden="true" />}>Noter</Button>
        </form>
      </Card>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      {entries.length ? (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="w-20 shrink-0 text-muted">{new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", weekday: "short", day: "numeric" }).format(new Date(`${e.day}T12:00:00Z`))}</span>
                <span className={cn("size-2.5 shrink-0 rounded-full", colorClass(e.color))} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate"><Link href={`/app/projets/${e.projectId}`} className="font-medium hover:text-accent">{e.projectName}</Link>{e.taskTitle ? ` · ${e.taskTitle}` : ""}{e.note ? <span className="text-muted"> · {e.note}</span> : null}</span>
                <span className="w-16 text-right font-medium tabular-nums">{fmtMinutes(e.minutes)}</span>
                {e.billed ? <span className="rounded bg-success-soft px-1.5 text-xs font-medium text-success">Facturé</span> : <button type="button" disabled={pending} onClick={() => run(() => deleteTime(e.id))} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label={`Supprimer ${fmtMinutes(e.minutes)} sur ${e.projectName}`}><Trash2 className="size-4" aria-hidden="true" /></button>}
              </li>
            ))}
          </ul>
        </Card>
      ) : <Card className="p-6 text-center text-sm text-muted">Rien de noté cette semaine.</Card>}
    </div>
  );
}

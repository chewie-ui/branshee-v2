"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, Clock, FileText, Pause, Pencil, Play, Plus, Trash2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { PROJECT_STATUS, TASK_STATUS, colorClass, fmtMinutes, parseDuration, timeValue } from "@/lib/projects";
import { deleteProject, deleteTask, deleteTime, invoiceProjectTime, logTime, moveTask, saveTask, setProjectStatus } from "@/server/actions/projects";
import type { EntryView, ProjectCard, TaskView } from "@/server/projects";
import { ProjectDialog, type CustomerOption } from "./project-form";

type Member = { id: string; name: string };
type Res = { ok: boolean; message?: string; error?: string; url?: string };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);
const fdate = (d: string) => new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00Z`));
const TIMER_KEY = "sky-timer";
type Timer = { projectId: string; taskId: string; start: number };

/** Page d'un projet : tâches en colonnes, temps passé (saisie ou chrono), facturation du temps. */
export function ProjectBoard({ project, tasks, entries, team, me, today, canManage, canInvoice, customers }: { project: ProjectCard; tasks: TaskView[]; entries: EntryView[]; team: Member[]; me: string; today: string; canManage: boolean; canInvoice: boolean; customers: CustomerOption[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"tasks" | "time">("tasks");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [task, setTask] = useState<TaskView | { status: string } | null>(null);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "invoice" | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const names = new Map(team.map((m) => [m.id, m.name]));
  const unbilledMinutes = entries.filter((e) => e.billable && !e.billed).reduce((a, e) => a + e.minutes, 0);

  const run = (fn: () => Promise<Res>, after?: (r: Res) => void) =>
    start(async () => {
      const r: Res = await fn().catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion." }));
      setMsg(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: r.error ?? "Action impossible." });
      if (r.ok) after?.(r);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <Link href="/app/projets" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" />Projets</Link>
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn("mt-2.5 size-3.5 shrink-0 rounded-full", colorClass(project.color))} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-muted">
            {project.customerId ? <Link href={`/app/clients/${project.customerId}`} className="hover:text-text">{project.customerName}</Link> : "Projet interne"}
            {project.deadline ? ` · échéance ${fdate(project.deadline)}` : ""}
            {project.status !== "active" ? ` · ${PROJECT_STATUS[project.status as keyof typeof PROJECT_STATUS]}` : ""}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => setEdit(true)}>Modifier</Button>
            {project.status === "active" ? <Button variant="secondary" icon={<Check className="size-4" aria-hidden="true" />} disabled={pending} onClick={() => run(() => setProjectStatus(project.id, "done"))}>Terminer</Button> : <Button variant="secondary" disabled={pending} onClick={() => run(() => setProjectStatus(project.id, "active"))}>Réouvrir</Button>}
          </div>
        ) : null}
      </div>
      {project.description ? <p className="max-w-prose whitespace-pre-line text-sm text-muted">{project.description}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-sm text-muted">Avancement</p><p className="mt-1 text-xl font-semibold tabular-nums">{project.done}/{project.tasks} tâches</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Temps passé</p><p className={cn("mt-1 text-xl font-semibold tabular-nums", project.budgetMinutes && project.minutes > project.budgetMinutes && "text-danger")}>{fmtMinutes(project.minutes)}</p><p className="text-xs text-muted">{project.budgetMinutes ? `Budget : ${fmtMinutes(project.budgetMinutes)}${project.minutes > project.budgetMinutes ? " (dépassé)" : ` (reste ${fmtMinutes(project.budgetMinutes - project.minutes)})`}` : "Pas de budget fixé"}</p></Card>
        <Card className="p-4">
          <p className="text-sm text-muted">À facturer</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{canManage && project.hourlyRateCents ? eur(timeValue(unbilledMinutes, project.hourlyRateCents)) : fmtMinutes(unbilledMinutes)}</p>
          {canManage && canInvoice ? (
            <Button size="sm" variant="secondary" className="mt-2" disabled={!unbilledMinutes || pending} icon={<FileText className="size-4" aria-hidden="true" />} onClick={() => setConfirm("invoice")}>Facturer le temps</Button>
          ) : <p className="text-xs text-muted">Temps facturable pas encore facturé</p>}
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-surface-muted p-1" role="tablist" aria-label="Vue">
          {([["tasks", "Tâches"], ["time", "Temps"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("h-8 rounded-md px-3 text-sm font-medium", tab === k ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>{l}</button>)}
        </div>
        <TimerButton projectId={project.id} tasks={tasks} today={today} onLogged={(t) => { setMsg({ ok: true, text: t }); router.refresh(); }} />
        {tab === "tasks" ? <Button className="ml-auto" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => { setMsg(null); setTask({ status: "todo" }); }}>Nouvelle tâche</Button> : null}
      </div>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}

      {tab === "tasks" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[880px] grid-cols-4 gap-3">
            {TASK_STATUS.map((s) => {
              const col = tasks.filter((t) => t.status === s.id);
              return (
                <section
                  key={s.id}
                  aria-labelledby={`ts-${s.id}`}
                  onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(s.id); } }}
                  onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
                  onDrop={(e) => { e.preventDefault(); setOver(null); const t = tasks.find((x) => x.id === drag); setDrag(null); if (t && t.status !== s.id) run(() => moveTask(t.id, s.id)); }}
                  className={cn("min-w-0 rounded-xl bg-surface-muted/60 p-2 transition-colors", over === s.id && "bg-accent-soft")}
                >
                  <h2 id={`ts-${s.id}`} className="mb-2 flex items-center justify-between px-2 pt-1 text-sm font-semibold">{s.label}<span className="text-xs font-normal text-muted">{col.length}</span></h2>
                  <ul className="space-y-2">
                    {col.map((t) => {
                      const late = t.dueDate && t.dueDate < today && t.status !== "done";
                      return (
                        <li key={t.id} draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => { setDrag(null); setOver(null); }} className={cn(drag === t.id && "opacity-50")}>
                          <button type="button" onClick={() => { setMsg(null); setTask(t); }} className="w-full rounded-lg border border-border bg-surface p-3 text-left shadow-sm hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                            <span className={cn("block text-sm font-medium", t.status === "done" && "text-muted line-through")}>{t.title}</span>
                            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                              {t.assigneeMemberId ? <span className="inline-flex items-center gap-1"><UserRound className="size-3" aria-hidden="true" />{names.get(t.assigneeMemberId) ?? "?"}</span> : null}
                              {t.dueDate ? <span className={cn("inline-flex items-center gap-1", late && "font-semibold text-danger")}><CalendarDays className="size-3" aria-hidden="true" />{fdate(t.dueDate)}</span> : null}
                              {t.minutes || t.estimateMinutes ? <span className="inline-flex items-center gap-1"><Clock className="size-3" aria-hidden="true" />{fmtMinutes(t.minutes)}{t.estimateMinutes ? ` / ${fmtMinutes(t.estimateMinutes)}` : ""}</span> : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    <li><button type="button" onClick={() => { setMsg(null); setTask({ status: s.id }); }} className="flex h-9 w-full items-center gap-1.5 rounded-lg px-2 text-sm text-muted hover:bg-surface hover:text-text"><Plus className="size-4" aria-hidden="true" />Ajouter</button></li>
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <TimeTab project={project} tasks={tasks} entries={entries} team={team} me={me} today={today} canManage={canManage} pending={pending} onRun={run} />
      )}

      {canManage ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {project.status !== "archived" ? <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setProjectStatus(project.id, "archived"))}>Archiver</Button> : null}
          <Button variant="ghost" size="sm" className="text-danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm("delete")}>Supprimer le projet</Button>
        </div>
      ) : null}

      {task ? <TaskDialog projectId={project.id} task={"id" in task ? task : null} status={task.status} team={team} onClose={() => setTask(null)} onDone={(t) => { setTask(null); setMsg({ ok: true, text: t }); router.refresh(); }} /> : null}
      {edit ? <ProjectDialog project={project} customers={customers} onClose={() => setEdit(false)} onDone={(t) => { setEdit(false); setMsg({ ok: true, text: t }); router.refresh(); }} /> : null}
      <ConfirmDialog
        open={!!confirm}
        title={confirm === "delete" ? "Supprimer ce projet ?" : "Facturer le temps ?"}
        confirmLabel={confirm === "delete" ? "Supprimer" : "Créer le brouillon"}
        danger={confirm === "delete"}
        loading={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => (confirm === "delete" ? deleteProject(project.id) : invoiceProjectTime(project.id)), (r) => { setConfirm(null); if (r.url) router.push(r.url); })}
      >
        {confirm === "delete" ? "Les tâches et le temps noté sont supprimés. Les factures déjà faites restent." : `Un brouillon de facture est créé pour ${project.customerName ?? "le client"} : ${fmtMinutes(unbilledMinutes)}${project.hourlyRateCents ? ` à ${eur(project.hourlyRateCents)} de l'heure` : ""}, une ligne par tâche. Vous pourrez le relire avant de l'émettre.`}
      </ConfirmDialog>
    </div>
  );
}

function TimeTab({ project, tasks, entries, team, me, today, canManage, pending, onRun }: { project: ProjectCard; tasks: TaskView[]; entries: EntryView[]; team: Member[]; me: string; today: string; canManage: boolean; pending: boolean; onRun: (fn: () => Promise<Res>, after?: (r: Res) => void) => void }) {
  const [f, setF] = useState({ day: today, duration: "", taskId: "", note: "", billable: true, memberId: me });
  const [err, setErr] = useState<string | null>(null);
  const titles = new Map(tasks.map((t) => [t.id, t.title]));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = parseDuration(f.duration);
    if (!minutes) return setErr("Durée non comprise : écrivez par exemple 1h30, 45 ou 2,5.");
    setErr(null);
    onRun(() => logTime({ projectId: project.id, taskId: f.taskId, memberId: f.memberId, day: f.day, minutes, note: f.note, billable: f.billable }), () => setF((s) => ({ ...s, duration: "", note: "" })));
  };
  const byDay = new Map<string, EntryView[]>();
  for (const e of entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[150px_120px_1fr_1fr_auto] lg:items-end" noValidate>
          <Field label="Jour" htmlFor="te-day"><Input id="te-day" type="date" max={today} value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} /></Field>
          <Field label="Durée" htmlFor="te-dur"><Input id="te-dur" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} placeholder="1h30" /></Field>
          <Field label="Tâche" htmlFor="te-task">
            <Select id="te-task" value={f.taskId} onChange={(e) => setF({ ...f, taskId: e.target.value })}>
              <option value="">Sans tâche précise</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Select>
          </Field>
          <Field label="Note (facultatif)" htmlFor="te-note"><Input id="te-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} /></Field>
          <Button type="submit" loading={pending} icon={<Plus className="size-4" aria-hidden="true" />}>Noter</Button>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-5">
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={f.billable} onChange={(e) => setF({ ...f, billable: e.target.checked })} className="size-4" />Facturable</label>
            {canManage && team.length > 1 ? (
              <label className="inline-flex items-center gap-2 text-sm">Pour
                <select value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm">{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              </label>
            ) : null}
          </div>
        </form>
        {err ? <p className="mt-3 text-sm text-danger" role="alert">{err}</p> : null}
      </Card>
      {entries.length === 0 ? <Card className="p-8 text-center text-sm text-muted">Aucun temps noté sur ce projet. Utilisez le chrono ou notez vos heures ci-dessus.</Card> : (
        <Card className="overflow-hidden">
          {[...byDay].map(([d, list]) => (
            <div key={d}>
              <h3 className="flex justify-between border-b border-border bg-surface-muted/60 px-5 py-2 text-sm font-medium"><span>{new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${d}T12:00:00Z`))}</span><span className="tabular-nums">{fmtMinutes(list.reduce((a, e) => a + e.minutes, 0))}</span></h3>
              <ul className="divide-y divide-border">
                {list.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="w-16 shrink-0 font-medium tabular-nums">{fmtMinutes(e.minutes)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{e.taskId ? titles.get(e.taskId) ?? "Tâche supprimée" : "Sans tâche précise"}{e.note ? <span className="text-muted"> · {e.note}</span> : null}</span>
                      <span className="block text-xs text-muted">{e.memberName ?? "Ancien membre"}</span>
                    </span>
                    {e.billed ? <span className="rounded bg-success-soft px-1.5 text-xs font-medium text-success">Facturé</span> : !e.billable ? <span className="rounded bg-surface-muted px-1.5 text-xs text-muted">Non facturable</span> : null}
                    {!e.billed && (e.memberId === me || canManage) ? <button type="button" disabled={pending} onClick={() => onRun(() => deleteTime(e.id))} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label={`Supprimer ${fmtMinutes(e.minutes)} du ${fdate(e.day)}`}><Trash2 className="size-4" aria-hidden="true" /></button> : <span className="size-9" />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/** Chrono : démarre sur ce projet (mémorisé dans ce navigateur), et à l'arrêt note le temps écoulé. */
function TimerButton({ projectId, tasks, today, onLogged }: { projectId: string; tasks: TaskView[]; today: string; onLogged: (t: string) => void }) {
  const [timer, setTimer] = useState<Timer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [taskId, setTaskId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const raw = localStorage.getItem(TIMER_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setTimer(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    if (!timer) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timer]);
  const mine = timer?.projectId === projectId;
  const elapsed = timer ? Math.max(0, Math.floor((now - timer.start) / 1000)) : 0;
  const hms = `${Math.floor(elapsed / 3600)}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const begin = () => {
    const t = { projectId, taskId, start: Date.now() };
    try { localStorage.setItem(TIMER_KEY, JSON.stringify(t)); } catch {}
    setTimer(t);
    setNow(Date.now());
  };
  const stop = () => {
    if (!timer) return;
    const minutes = Math.max(1, Math.round(elapsed / 60));
    start(async () => {
      setError(null);
      const r: Res = await logTime({ projectId: timer.projectId, taskId: timer.taskId, day: today, minutes, note: "", billable: true }).catch(() => ({ ok: false, error: "Envoi impossible." }));
      if (!r.ok) return setError(r.error ?? "Envoi impossible.");
      try { localStorage.removeItem(TIMER_KEY); } catch {}
      setTimer(null);
      onLogged(r.message ?? "Temps noté.");
    });
  };
  const cancel = () => { try { localStorage.removeItem(TIMER_KEY); } catch {} setTimer(null); };
  if (timer && !mine) return <p className="text-sm text-muted">Un chrono tourne sur un autre projet ({hms}).</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {timer ? (
        <>
          <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-soft px-3 font-semibold text-accent tabular-nums" role="timer" aria-label="Chrono">{hms}</span>
          <Button variant="secondary" loading={pending} icon={<Pause className="size-4" aria-hidden="true" />} onClick={stop}>Arrêter et noter</Button>
          <button type="button" onClick={cancel} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label="Annuler le chrono"><X className="size-4" aria-hidden="true" /></button>
        </>
      ) : (
        <>
          {tasks.length ? (
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)} aria-label="Tâche chronométrée" className="h-10 max-w-48 rounded-lg border border-border bg-surface px-2 text-sm">
              <option value="">Sans tâche précise</option>
              {tasks.filter((t) => t.status !== "done").map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          ) : null}
          <Button variant="secondary" icon={<Play className="size-4" aria-hidden="true" />} onClick={begin}>Chrono</Button>
        </>
      )}
      {error ? <span className="text-sm text-danger" role="alert">{error}</span> : null}
    </div>
  );
}

function TaskDialog({ projectId, task, status, team, onClose, onDone }: { projectId: string; task: TaskView | null; status: string; team: Member[]; onClose: () => void; onDone: (t: string) => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [f, setF] = useState({ title: task?.title ?? "", description: task?.description ?? "", assigneeMemberId: task?.assigneeMemberId ?? "", dueDate: task?.dueDate ?? "", estimate: task?.estimateMinutes ? fmtMinutes(task.estimateMinutes).replace(/\s/g, "") : "" });
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const est = f.estimate.trim() ? parseDuration(f.estimate.replace("min", "m")) : null;
    if (f.estimate.trim() && est === null) return setError("Estimation non comprise : écrivez par exemple 2h ou 30.");
    start(async () => {
      setError(null);
      const r: Res = await saveTask({ id: task?.id, projectId, title: f.title, description: f.description, status, assigneeMemberId: f.assigneeMemberId, dueDate: f.dueDate, estimateMinutes: est ?? "" }).catch(() => ({ ok: false, error: "Envoi impossible. Vérifiez votre connexion et réessayez." }));
      if (!r.ok) return setError(r.error ?? "Envoi impossible.");
      onDone(r.message ?? "Enregistré.");
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="tk-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <form ref={ref} onSubmit={submit} className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl" noValidate>
        <h2 id="tk-title" className="text-lg font-semibold">{task ? "Modifier la tâche" : "Nouvelle tâche"}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Titre" htmlFor="tk-name" className="sm:col-span-2"><Input id="tk-name" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} required /></Field>
          <Field label="Pour qui" htmlFor="tk-who">
            <Select id="tk-who" value={f.assigneeMemberId} onChange={(e) => setF({ ...f, assigneeMemberId: e.target.value })}>
              <option value="">Personne</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="Pour le" htmlFor="tk-due"><Input id="tk-due" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
          <Field label="Temps estimé" htmlFor="tk-est" hint="Ex. : 2h, 30"><Input id="tk-est" value={f.estimate} onChange={(e) => setF({ ...f, estimate: e.target.value })} /></Field>
          <Field label="Détails (facultatif)" htmlFor="tk-desc" className="sm:col-span-2"><Textarea id="tk-desc" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={4000} /></Field>
        </div>
        {error ? <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {task ? <Button type="button" variant="ghost" className="text-danger sm:mr-auto" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)} disabled={pending}>Supprimer</Button> : <span className="sm:mr-auto" />}
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button type="submit" loading={pending}>Enregistrer</Button>
        </div>
      </form>
      <ConfirmDialog open={confirm} title="Supprimer cette tâche ?" confirmLabel="Supprimer" danger loading={pending} onCancel={() => setConfirm(false)} onConfirm={() => task && start(async () => { const r: Res = await deleteTask(task.id); if (!r.ok) { setConfirm(false); return setError(r.error ?? "Suppression impossible."); } onDone(r.message ?? "Supprimée."); })}>
        Le temps déjà noté sur cette tâche reste dans le projet.
      </ConfirmDialog>
    </div>
  );
}

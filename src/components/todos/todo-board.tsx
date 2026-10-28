"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, CalendarDays, Check, Flag, Hash, ListChecks, Lock, Pencil, Plus, Repeat, Trash2, UserRound, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { LIST_COLORS, PRIORITY_LABEL, RECURRENCE_LABEL, dueLabel, parseQuickAdd, type Recurrence } from "@/lib/todos";
import { addTask, archiveList, deleteTask, saveList, toggleTask, updateTask } from "@/server/actions/todos";

export type TodoTask = { id: string; title: string; notes: string | null; dueDate: string | null; dueTime: string | null; priority: number; recurrence: string | null; listId: string | null; parentId: string | null; assignee: string | null; createdBy: string | null; completedAt: string | null };
export type TodoList = { id: string; name: string; color: string; visibility: string; createdBy: string | null; open: number; memberIds?: string[] };
type Person = { id: string; name: string };
type Res = { ok: boolean; message?: string; error?: string; id?: string };

export const DOT: Record<string, string> = { slate: "bg-slate-400", red: "bg-red-500", orange: "bg-orange-500", amber: "bg-amber-500", green: "bg-green-600", teal: "bg-teal-600", blue: "bg-blue-600", violet: "bg-violet-600", pink: "bg-pink-500" };
const PRIO_RING: Record<number, string> = { 1: "border-red-600 text-red-600", 2: "border-orange-500 text-orange-500", 3: "border-blue-600 text-blue-600", 4: "border-border-strong text-muted" };
const PRIO_FILL: Record<number, string> = { 1: "bg-red-600", 2: "bg-orange-500", 3: "bg-blue-600", 4: "bg-muted" };
const initials = (n: string) => n.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();

/** Vue de tâches (Aujourd'hui, À venir, Boîte de réception, une liste) avec ajout rapide et détail. */
export function TodoBoard({ title, view, tasks, subs, lists, team, today, me, list, canEditList, showDone }: { title: string; view: "inbox" | "today" | "upcoming" | "list"; tasks: TodoTask[]; subs: TodoTask[]; lists: TodoList[]; team: Person[]; today: string; me: string; list?: TodoList; canEditList?: boolean; showDone: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [editList, setEditList] = useState(false);
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (text.trim() ? parseQuickAdd(text, today, lists, team) : null), [text, today, lists, team]);
  const listName = new Map(lists.map((l) => [l.id, l] as const));
  const who = new Map(team.map((p) => [p.id, p.name] as const));
  const subsOf = (id: string) => subs.filter((s) => s.parentId === id);
  const run = (fn: () => Promise<Res>, after?: (r: Res) => void) =>
    start(async () => {
      const r: Res = await fn().catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion." }));
      if (!r.ok || r.message) setMsg({ ok: r.ok, text: r.ok ? r.message! : (r.error ?? "Action impossible.") });
      if (r.ok) after?.(r);
      router.refresh();
    });
  const toggle = (t: TodoTask) => {
    setOptimistic((o) => ({ ...o, [t.id]: !t.completedAt }));
    run(() => toggleTask(t.id), () => setTimeout(() => setOptimistic((o) => { const n = { ...o }; delete n[t.id]; return n; }), 600));
  };
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setMsg(null);
    run(() => addTask({ text, listId: view === "list" ? (list?.id ?? null) : null, dueDate: view === "today" ? today : null }), () => setText(""));
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "q" && !open && !editList && document.activeElement === document.body) { e.preventDefault(); input.current?.focus(); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [open, editList]);

  const done = (t: TodoTask) => optimistic[t.id] ?? !!t.completedAt;
  const groups: { key: string; label: string; items: TodoTask[] }[] = [];
  if (view === "today") {
    const late = tasks.filter((t) => t.dueDate! < today);
    if (late.length) groups.push({ key: "late", label: "En retard", items: late });
    groups.push({ key: "today", label: "Aujourd'hui", items: tasks.filter((t) => t.dueDate! >= today) });
  } else if (view === "upcoming") {
    const late = tasks.filter((t) => t.dueDate! < today);
    if (late.length) groups.push({ key: "late", label: "En retard", items: late });
    const days = [...new Set(tasks.filter((t) => t.dueDate! >= today).map((t) => t.dueDate!))].sort();
    for (const d of days) { const l = dueLabel(d, today); groups.push({ key: d, label: `${l.text} · ${new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`))}`, items: tasks.filter((t) => t.dueDate === d) }); }
  } else groups.push({ key: "all", label: "", items: tasks });
  const openTask = tasks.find((t) => t.id === open) ?? subs.find((t) => t.id === open) ?? null;
  const total = tasks.filter((t) => !done(t)).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {list ? <span className={cn("size-3 rounded-full", DOT[list.color] ?? DOT.slate)} aria-hidden="true" /> : null}
        <h1 className="text-2xl font-semibold">{title}</h1>
        <span className="text-sm text-muted tabular-nums">{total} tâche{total > 1 ? "s" : ""}</span>
        {list ? <span className="inline-flex items-center gap-1 text-xs text-muted">{list.visibility === "team" ? <><Users className="size-3.5" aria-hidden="true" />Toute l&apos;équipe</> : list.visibility === "private" ? <><Lock className="size-3.5" aria-hidden="true" />Privée</> : <><UserRound className="size-3.5" aria-hidden="true" />Partagée</>}</span> : null}
        <div className="ml-auto flex gap-2">
          <Link href={`?${showDone ? "" : "terminees=1"}`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-muted hover:bg-surface-muted hover:text-text">{showDone ? "Masquer les terminées" : "Afficher les terminées"}</Link>
          {list && canEditList ? <Button size="sm" variant="secondary" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => setEditList(true)}>Modifier</Button> : null}
        </div>
      </div>

      <form onSubmit={add} className="rounded-xl border border-border bg-surface p-3 shadow-sm focus-within:border-accent">
        <label htmlFor="todo-add" className="sr-only">Ajouter une tâche</label>
        <div className="flex items-center gap-2">
          <Plus className="size-5 shrink-0 text-accent" aria-hidden="true" />
          <input ref={input} id="todo-add" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} autoComplete="off" placeholder="Ajouter une tâche : « Appeler Marc demain 14h p1 #liste @prénom »" className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted sm:text-sm" />
          <Button type="submit" size="sm" loading={pending && !!text} disabled={!text.trim()}>Ajouter</Button>
        </div>
        {preview && (preview.dueDate || preview.listId || preview.assigneeId || preview.priority < 4 || preview.recurrence) ? (
          <p className="mt-2 flex flex-wrap gap-2 pl-7 text-xs" aria-live="polite">
            {preview.dueDate ? <span className="inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 py-0.5 text-accent"><CalendarDays className="size-3.5" aria-hidden="true" />{dueLabel(preview.dueDate, today).text}{preview.dueTime ? ` ${preview.dueTime}` : ""}</span> : null}
            {preview.recurrence ? <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-1.5 py-0.5"><Repeat className="size-3.5" aria-hidden="true" />{RECURRENCE_LABEL[preview.recurrence]}</span> : null}
            {preview.priority < 4 ? <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-1.5 py-0.5"><Flag className="size-3.5" aria-hidden="true" />{PRIORITY_LABEL[preview.priority]}</span> : null}
            {preview.listId ? <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-1.5 py-0.5"><Hash className="size-3.5" aria-hidden="true" />{listName.get(preview.listId)?.name}</span> : null}
            {preview.assigneeId ? <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-1.5 py-0.5"><UserRound className="size-3.5" aria-hidden="true" />{who.get(preview.assigneeId)}</span> : null}
          </p>
        ) : null}
      </form>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}

      {!tasks.length ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <ListChecks className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-medium">{view === "today" ? "Rien pour aujourd'hui" : view === "upcoming" ? "Rien de prévu" : "Aucune tâche"}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Tapez une tâche ci-dessus. Astuce : la touche Q place le curseur dans le champ.</p>
        </div>
      ) : groups.map((g) => g.items.length ? (
        <section key={g.key} aria-label={g.label || title}>
          {g.label ? <h2 className={cn("mb-1 border-b border-border pb-1 text-sm font-semibold first-letter:uppercase", g.key === "late" && "text-danger")}>{g.label}</h2> : null}
          <ul>
            {g.items.map((t) => {
              const sub = subsOf(t.id);
              const due = t.dueDate ? dueLabel(t.dueDate, today) : null;
              const l = t.listId ? listName.get(t.listId) : null;
              const isDone = done(t);
              return (
                <li key={t.id} className="group flex items-start gap-3 border-b border-border/60 py-2.5">
                  <button type="button" onClick={() => toggle(t)} aria-label={isDone ? `Rouvrir « ${t.title} »` : `Terminer « ${t.title} »`} aria-pressed={isDone} className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors", PRIO_RING[t.priority] ?? PRIO_RING[4], isDone && cn(PRIO_FILL[t.priority], "border-transparent text-white"))}>
                    <Check className={cn("size-3", isDone ? "opacity-100" : "opacity-0 group-hover:opacity-60")} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setOpen(t.id)} className="min-w-0 flex-1 text-left">
                    <span className={cn("block text-sm", isDone && "text-muted line-through")}>{t.title}</span>
                    {t.notes ? <span className="block truncate text-xs text-muted">{t.notes}</span> : null}
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                      {due && view !== "today" ? <span className={cn("inline-flex items-center gap-1", due.late && !isDone && "text-danger")}><CalendarDays className="size-3.5" aria-hidden="true" />{due.text}{t.dueTime ? ` ${t.dueTime}` : ""}</span> : t.dueTime ? <span>{t.dueTime}</span> : null}
                      {t.recurrence ? <Repeat className="size-3.5" aria-label={RECURRENCE_LABEL[t.recurrence as Recurrence]} /> : null}
                      {sub.length ? <span className="inline-flex items-center gap-1"><ListChecks className="size-3.5" aria-hidden="true" />{sub.filter((s) => s.completedAt).length}/{sub.length}</span> : null}
                      {l && view !== "list" ? <span className="inline-flex items-center gap-1"><span className={cn("size-2 rounded-full", DOT[l.color] ?? DOT.slate)} aria-hidden="true" />{l.name}</span> : null}
                    </span>
                  </button>
                  {t.assignee ? <span title={who.get(t.assignee)} className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", t.assignee === me ? "bg-accent text-accent-foreground" : "bg-surface-muted text-text")} aria-label={`Confiée à ${who.get(t.assignee) ?? "un membre"}`}>{initials(who.get(t.assignee) ?? "?")}</span> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null)}

      {openTask ? <TaskDetail key={openTask.id} task={openTask} subs={subsOf(openTask.id)} lists={lists} team={team} today={today} onClose={() => setOpen(null)} onOpen={setOpen} /> : null}
      {editList && list ? <ListDialog team={team} me={me} initial={list} onClose={() => setEditList(false)} /> : null}
    </div>
  );
}

function TaskDetail({ task, subs, lists, team, today, onClose, onOpen }: { task: TodoTask; subs: TodoTask[]; lists: TodoList[]; team: Person[]; today: string; onClose: () => void; onOpen: (id: string) => void }) {
  const router = useRouter();
  const [f, setF] = useState({ title: task.title, notes: task.notes ?? "" });
  const [sub, setSub] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const save = (patch: Parameters<typeof updateTask>[1]) => start(async () => { const r: Res = await updateTask(task.id, patch).catch(() => ({ ok: false, error: "Enregistrement impossible." })); setErr(r.ok ? null : (r.error ?? "Enregistrement impossible.")); router.refresh(); });
  const act = (fn: () => Promise<Res>, after?: () => void) => start(async () => { const r: Res = await fn().catch(() => ({ ok: false, error: "Action impossible." })); setErr(r.ok ? null : (r.error ?? "Action impossible.")); if (r.ok) after?.(); router.refresh(); });
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="td-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <div ref={ref} className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <h2 id="td-title" className="flex-1 font-semibold">{task.parentId ? "Sous-tâche" : "Tâche"}</h2>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label="Fermer"><X className="size-5" aria-hidden="true" /></button>
        </div>
        <div className="space-y-4 p-5">
          <Field label="Titre" htmlFor="td-t"><Input id="td-t" value={f.title} maxLength={300} onChange={(e) => setF({ ...f, title: e.target.value })} onBlur={() => f.title.trim() && f.title !== task.title && save({ title: f.title })} /></Field>
          <Field label="Notes" htmlFor="td-n"><Textarea id="td-n" rows={3} value={f.notes} maxLength={5000} onChange={(e) => setF({ ...f, notes: e.target.value })} onBlur={() => f.notes !== (task.notes ?? "") && save({ notes: f.notes })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Échéance" htmlFor="td-d"><Input id="td-d" type="date" defaultValue={task.dueDate ?? ""} onChange={(e) => save({ dueDate: e.target.value || null })} /></Field>
            <Field label="Heure" htmlFor="td-h"><Input id="td-h" type="time" defaultValue={task.dueTime ?? ""} onChange={(e) => save({ dueTime: e.target.value || null })} /></Field>
            <Field label="Priorité" htmlFor="td-p"><Select id="td-p" defaultValue={task.priority} onChange={(e) => save({ priority: Number(e.target.value) })}>{[1, 2, 3, 4].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</Select></Field>
            {!task.parentId ? <Field label="Répéter" htmlFor="td-r"><Select id="td-r" defaultValue={task.recurrence ?? ""} onChange={(e) => save({ recurrence: (e.target.value || null) as Recurrence | null })}><option value="">Jamais</option>{Object.entries(RECURRENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field> : <span />}
            <Field label="Confiée à" htmlFor="td-a"><Select id="td-a" defaultValue={task.assignee ?? ""} onChange={(e) => save({ assigneeId: e.target.value || null })}><option value="">Personne</option>{team.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
            {!task.parentId ? <Field label="Liste" htmlFor="td-l"><Select id="td-l" defaultValue={task.listId ?? ""} onChange={(e) => save({ listId: e.target.value || null })}><option value="">Boîte de réception</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field> : null}
          </div>
          {task.dueDate && task.dueDate < today && !task.completedAt ? <p className="text-sm text-danger">En retard depuis {dueLabel(task.dueDate, today).text.toLowerCase()}.</p> : null}
          {!task.parentId ? (
            <section aria-labelledby="td-subs" className="space-y-2">
              <h3 id="td-subs" className="text-sm font-semibold">Sous-tâches</h3>
              <ul className="space-y-1">
                {subs.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <button type="button" onClick={() => act(() => toggleTask(s.id))} aria-pressed={!!s.completedAt} aria-label={s.completedAt ? `Rouvrir « ${s.title} »` : `Terminer « ${s.title} »`} className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-border-strong", s.completedAt && "border-transparent bg-muted text-white")}>{s.completedAt ? <Check className="size-2.5" aria-hidden="true" /> : null}</button>
                    <button type="button" onClick={() => onOpen(s.id)} className={cn("flex-1 text-left hover:underline", s.completedAt && "text-muted line-through")}>{s.title}</button>
                  </li>
                ))}
              </ul>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (sub.trim()) act(() => addTask({ text: sub, parentId: task.id }), () => setSub("")); }}>
                <label htmlFor="td-sub" className="sr-only">Ajouter une sous-tâche</label>
                <Input id="td-sub" value={sub} onChange={(e) => setSub(e.target.value)} maxLength={500} placeholder="Ajouter une sous-tâche" />
                <Button type="submit" size="sm" variant="secondary" disabled={!sub.trim() || pending}>Ajouter</Button>
              </form>
            </section>
          ) : null}
          {err ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{err}</p> : null}
          <div className="flex gap-2 border-t border-border pt-4">
            <Button variant="secondary" disabled={pending} onClick={() => act(() => toggleTask(task.id), onClose)}>{task.completedAt ? "Rouvrir" : "Terminer"}</Button>
            <Button variant="ghost" className="ml-auto text-danger" icon={<Trash2 className="size-4" aria-hidden="true" />} disabled={pending} onClick={() => act(() => deleteTask(task.id), onClose)}>Supprimer</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Créer ou modifier une liste : nom, couleur, qui la voit. */
export function ListDialog({ team, me, initial, onClose }: { team: Person[]; me: string; initial?: TodoList; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ name: initial?.name ?? "", color: initial?.color ?? "blue", visibility: initial?.visibility ?? "team", memberIds: initial?.memberIds ?? [] });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r: Res = await saveList({ id: initial?.id, ...f, color: f.color as (typeof LIST_COLORS)[number], visibility: f.visibility as "team" | "private" | "members" }).catch(() => ({ ok: false, error: "Enregistrement impossible." }));
      if (!r.ok) return setErr(r.error ?? "Enregistrement impossible.");
      onClose();
      if (!initial && r.id) router.push(`/app/taches/listes/${r.id}`); else router.refresh();
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="tl-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <form onSubmit={submit} className="relative max-h-[92dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-2xl bg-surface p-6 shadow-xl sm:rounded-2xl" noValidate>
        <h2 id="tl-title" className="text-lg font-semibold">{initial ? "Modifier la liste" : "Nouvelle liste"}</h2>
        <Field label="Nom" htmlFor="tl-name"><Input id="tl-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={60} autoFocus placeholder="Ex. : Chantier Dupont, Courses, Admin" /></Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Couleur</legend>
          <div className="flex flex-wrap gap-2">{LIST_COLORS.map((c) => <button key={c} type="button" onClick={() => setF({ ...f, color: c })} aria-pressed={f.color === c} aria-label={c} className={cn("size-8 rounded-full ring-offset-2 ring-offset-surface", DOT[c], f.color === c && "ring-2 ring-accent")} />)}</div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Qui la voit ?</legend>
          {([["team", "Toute l'équipe"], ["members", "Certaines personnes"], ["private", "Moi seul"]] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="tl-vis" className="size-4" checked={f.visibility === k} onChange={() => setF({ ...f, visibility: k })} />{l}</label>)}
          {f.visibility === "members" ? (
            <div className="ml-6 grid gap-1.5">
              {team.filter((p) => p.id !== me).map((p) => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.memberIds.includes(p.id)} onChange={(e) => setF({ ...f, memberIds: e.target.checked ? [...f.memberIds, p.id] : f.memberIds.filter((x) => x !== p.id) })} />{p.name}</label>)}
              {team.length <= 1 ? <p className="text-xs text-muted">Invitez d&apos;abord des collègues dans Employés.</p> : null}
            </div>
          ) : null}
        </fieldset>
        {err ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{err}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {initial ? <Button type="button" variant="ghost" className="text-danger sm:mr-auto" icon={<Archive className="size-4" aria-hidden="true" />} disabled={pending} onClick={() => start(async () => { const r: Res = await archiveList(initial.id).catch(() => ({ ok: false, error: "Action impossible." })); if (!r.ok) return setErr(r.error ?? "Action impossible."); router.push("/app/taches/listes"); })}>Archiver</Button> : null}
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button type="submit" loading={pending}>{initial ? "Enregistrer" : "Créer la liste"}</Button>
        </div>
      </form>
    </div>
  );
}

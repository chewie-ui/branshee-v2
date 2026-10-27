"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, ChevronLeft, ChevronRight, Copy, Download, Eraser, MoreHorizontal, Plus, Printer, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { DAY_LABELS, DAY_SHORT, addDays, dayLabel, dayNum, fmtHours, overnight, shiftMinutes } from "@/lib/planning";
import { clearWeek, copyPreviousWeek, deleteShift, planningFeedToken, saveShift } from "@/server/actions/planning";
import type { PlanningMember, ShiftView } from "@/server/planning";

type R = { ok: true; message?: string; token?: string } | { ok: false; error: string };
type Draft = { id?: string; memberIds: string[]; days: string[]; start: string; end: string; breakMinutes: string; label: string; note: string };

const PRESETS = [
  { label: "Journée", start: "09:00", end: "17:00", pause: "30" },
  { label: "Matin", start: "08:00", end: "12:00", pause: "0" },
  { label: "Après-midi", start: "13:00", end: "17:00", pause: "0" },
  { label: "Soir", start: "18:00", end: "23:00", pause: "0" },
];

/**
 * Planning de la semaine : vue « Équipe » (une ligne par personne) ou « Jour par jour ».
 * Le responsable ajoute, modifie et recopie ; chacun voit ses horaires et peut les mettre dans son agenda.
 */
export function PlanningBoard({ monday, today, members, shifts, canManage, origin }: { monday: string; today: string; members: PlanningMember[]; shifts: ShiftView[]; canManage: boolean; origin: string }) {
  const router = useRouter();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const [view, setView] = useState<"team" | "days">("team");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<null | "clear" | { id: string }>(null);
  const [menu, setMenu] = useState(false);
  const [feed, setFeed] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const byMember = (id: string) => shifts.filter((s) => s.memberId === id);
  const minutesOf = (list: ShiftView[]) => list.reduce((a, s) => a + shiftMinutes(s.start, s.end, s.breakMinutes), 0);
  const name = new Map(members.map((m) => [m.id, m.name]));
  const weekTotal = minutesOf(shifts);

  const run = (fn: () => Promise<R>, after?: (r: R) => void) =>
    start(async () => {
      const r = await fn().catch(() => ({ ok: false as const, error: "Une erreur est survenue. Réessayez." }));
      setMsg(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: r.error });
      after?.(r);
      if (r.ok) router.refresh();
    });

  const openNew = (memberId?: string, day?: string) => {
    setFormError(null);
    setDraft({ memberIds: memberId ? [memberId] : members.length === 1 ? [members[0]!.id] : [], days: day ? [day] : [], start: "09:00", end: "17:00", breakMinutes: "30", label: "", note: "" });
  };
  const openEdit = (s: ShiftView) => {
    setFormError(null);
    setDraft({ id: s.id, memberIds: [s.memberId], days: [s.day], start: s.start, end: s.end, breakMinutes: String(s.breakMinutes), label: s.label ?? "", note: s.note ?? "" });
  };
  const submit = () => {
    if (!draft) return;
    start(async () => {
      const r = await saveShift({ id: draft.id, memberIds: draft.memberIds, days: draft.days, start: draft.start, end: draft.end, breakMinutes: Number(draft.breakMinutes) || 0, label: draft.label, note: draft.note }).catch(() => ({ ok: false as const, error: "Une erreur est survenue. Réessayez." }));
      if (!r.ok) return setFormError(r.error);
      setDraft(null);
      setMsg({ ok: true, text: r.message ?? "Enregistré." });
      router.refresh();
    });
  };
  const showFeed = () =>
    run(planningFeedToken, (r) => {
      if (r.ok && r.token) setFeed(`${origin}/ical/horaires/${r.token}`);
    });

  const week = (n: number) => `/app/planning?semaine=${addDays(monday, n * 7)}`;
  const chip = (s: ShiftView, withName = false) => (
    <button
      key={s.id}
      type="button"
      onClick={canManage ? () => openEdit(s) : undefined}
      disabled={!canManage}
      className={cn("w-full rounded-md border border-accent/25 bg-accent-soft px-2 py-1 text-left text-xs text-accent-soft-foreground transition-colors", canManage ? "hover:border-accent focus-visible:outline-2 focus-visible:outline-accent" : "cursor-default")}
      aria-label={`${withName ? `${name.get(s.memberId)}, ` : ""}${s.start} à ${s.end}${s.label ? `, ${s.label}` : ""}${canManage ? ", modifier" : ""}`}
    >
      {withName ? <span className="block truncate font-semibold">{name.get(s.memberId)}</span> : null}
      <span className="block font-semibold tabular-nums">{s.start}–{s.end}{overnight(s.start, s.end) ? " (+1)" : ""}</span>
      {s.label ? <span className="block truncate">{s.label}</span> : null}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Semaine et actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-lg border border-border-strong bg-surface">
          <Link href={week(-1)} className="flex size-10 items-center justify-center text-muted hover:text-text" aria-label="Semaine précédente"><ChevronLeft className="size-4" aria-hidden="true" /></Link>
          <Link href={`/app/planning?semaine=${today}`} className="flex h-10 items-center border-x border-border px-3 text-sm font-medium hover:bg-surface-muted">Cette semaine</Link>
          <Link href={week(1)} className="flex size-10 items-center justify-center text-muted hover:text-text" aria-label="Semaine suivante"><ChevronRight className="size-4" aria-hidden="true" /></Link>
        </div>
        <div className="inline-flex rounded-lg bg-surface-muted p-1" role="radiogroup" aria-label="Affichage">
          {([["team", "Équipe"], ["days", "Jour par jour"]] as const).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)} className={cn("h-8 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent", view === v ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>
              {l}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted">Total : <span className="font-medium text-text tabular-nums">{fmtHours(weekTotal)}</span></span>
        <div className="ml-auto flex items-center gap-2">
          {canManage ? <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => openNew()}>Ajouter des horaires</Button> : null}
          <div className="relative">
            <Button variant="secondary" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="menu" aria-label="Plus d'actions" icon={<MoreHorizontal className="size-4" aria-hidden="true" />}>Plus</Button>
            {menu ? (
              <>
                <button type="button" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} aria-label="Fermer" tabIndex={-1} />
                <div role="menu" className="absolute top-full right-0 z-20 mt-1 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
                  {canManage ? (
                    <MenuItem icon={<Copy />} onClick={() => { setMenu(false); run(() => copyPreviousWeek(monday)); }}>Recopier la semaine précédente</MenuItem>
                  ) : null}
                  <a role="menuitem" href={`/app/planning/export?semaine=${monday}`} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface-muted [&_svg]:size-4 [&_svg]:text-muted"><Download aria-hidden="true" />Exporter en Excel</a>
                  <a role="menuitem" href={`/imprimer/planning?semaine=${monday}`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface-muted [&_svg]:size-4 [&_svg]:text-muted"><Printer aria-hidden="true" />Imprimer ou PDF</a>
                  <MenuItem icon={<CalendarPlus />} onClick={() => { setMenu(false); showFeed(); }}>Ajouter à mon agenda</MenuItem>
                  {canManage && shifts.length ? (
                    <>
                      <div className="my-1 border-t border-border" />
                      <MenuItem icon={<Eraser />} danger onClick={() => { setMenu(false); setConfirm("clear"); }}>Vider cette semaine</MenuItem>
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}

      {feed ? (
        <Card className="p-4">
          <p className="font-medium">Votre planning dans Google Agenda, Apple ou Outlook</p>
          <p className="mt-1 text-sm text-muted">Copiez ce lien, puis dans Google Agenda : « Autres agendas » › « + » › « À partir de l&apos;URL ». Vos horaires s&apos;y mettent à jour tout seuls{members.length > 1 && canManage ? " (ceux de toute l'équipe, avec le nom de chacun)" : ""}.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={feed} onFocus={(e) => e.currentTarget.select()} aria-label="Lien de l'agenda" />
            <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(feed).then(() => setMsg({ ok: true, text: "Lien copié." }))}>Copier</Button>
          </div>
        </Card>
      ) : null}

      {members.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-medium">Personne dans l&apos;équipe pour l&apos;instant</p>
          <p className="mt-1 text-sm text-muted">Ajoutez vos collaborateurs dans Équipe, puis revenez faire leur planning.</p>
          <ButtonLink href="/app/equipe" variant="secondary" className="mt-4">Ouvrir Équipe</ButtonLink>
        </Card>
      ) : view === "team" ? (
        <Card className="relative overflow-x-auto">
          <table className="w-full min-w-[880px] table-fixed border-collapse text-sm">
            <caption className="sr-only">Planning de l&apos;équipe, semaine du {dayLabel(monday)}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="w-52 px-4 py-3 text-left font-medium text-muted">Personne</th>
                {days.map((d, i) => (
                  <th key={d} scope="col" className={cn("px-2 py-3 text-left font-medium", d === today ? "text-accent" : "text-muted")}>
                    {DAY_SHORT[i]} <span className={cn("tabular-nums", d === today ? "rounded-full bg-accent px-1.5 text-accent-foreground" : "")}>{dayNum(d)}</span>
                  </th>
                ))}
                <th scope="col" className="w-20 px-3 py-3 text-right font-medium text-muted">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => {
                const mine = byMember(m.id);
                return (
                  <tr key={m.id} className={m.isMe ? "bg-accent-soft/30" : undefined}>
                    <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={m.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{m.name}{m.isMe ? <span className="font-normal text-muted"> (vous)</span> : null}</span>
                          {m.role ? <span className="block truncate text-xs text-muted">{m.role}</span> : null}
                        </span>
                      </span>
                    </th>
                    {days.map((d) => {
                      const list = mine.filter((s) => s.day === d);
                      return (
                        <td key={d} className="px-1.5 py-2 align-top">
                          <div className="flex min-h-14 flex-col gap-1">
                            {list.map((s) => chip(s))}
                            {canManage ? (
                              <button type="button" onClick={() => openNew(m.id, d)} className={cn("flex items-center justify-center rounded-md border border-dashed border-border text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent", list.length ? "h-6" : "min-h-12 flex-1")} aria-label={`Ajouter un horaire pour ${m.name}, ${dayLabel(d)}`}>
                                <Plus className="size-3.5" aria-hidden="true" />
                              </button>
                            ) : !list.length ? <span className="px-2 py-1 text-xs text-muted">—</span> : null}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-right align-top font-medium tabular-nums">{fmtHours(minutesOf(mine))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {days.map((d, i) => {
            const list = shifts.filter((s) => s.day === d).sort((a, b) => a.start.localeCompare(b.start));
            return (
              <Card key={d} className={cn("p-4", d === today ? "border-accent" : "")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{DAY_LABELS[i]} {dayNum(d)}</p>
                  <span className="text-xs text-muted">{list.length ? `${new Set(list.map((s) => s.memberId)).size} pers. · ${fmtHours(minutesOf(list))}` : "Personne"}</span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {list.map((s) => chip(s, true))}
                  {canManage ? (
                    <button type="button" onClick={() => openNew(undefined, d)} className="flex h-8 w-full items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
                      <Plus className="size-3.5" aria-hidden="true" />Ajouter
                    </button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {draft ? <ShiftDialog draft={draft} setDraft={setDraft} members={members} days={days} error={formError} pending={pending} onSubmit={submit} onDelete={draft.id ? () => setConfirm({ id: draft.id! }) : undefined} /> : null}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "clear" ? "Vider cette semaine ?" : "Supprimer cet horaire ?"}
        confirmLabel={confirm === "clear" ? "Vider la semaine" : "Supprimer"}
        danger
        loading={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const c = confirm;
          if (c === "clear") run(() => clearWeek(monday), () => setConfirm(null));
          else if (c) run(() => deleteShift(c.id), (r) => { setConfirm(null); if (r.ok) setDraft(null); });
        }}
      >
        {confirm === "clear" ? `Les ${shifts.length} horaires de la semaine seront supprimés.` : "Cet horaire sera retiré du planning."}
      </ConfirmDialog>
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger = false }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-surface-muted [&_svg]:size-4", danger ? "text-danger [&_svg]:text-danger" : "[&_svg]:text-muted")}>
      <span aria-hidden="true" className="contents">{icon}</span>
      {children}
    </button>
  );
}

function ShiftDialog({ draft, setDraft, members, days, error, pending, onSubmit, onDelete }: { draft: Draft; setDraft: (d: Draft | null) => void; members: PlanningMember[]; days: string[]; error: string | null; pending: boolean; onSubmit: () => void; onDelete?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const editing = !!draft.id;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const toggle = (key: "memberIds" | "days", v: string) => set({ [key]: editing ? [v] : draft[key].includes(v) ? draft[key].filter((x) => x !== v) : [...draft[key], v] });
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input,button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDraft(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDraft]);
  const minutes = /^\d\d:\d\d$/.test(draft.start) && /^\d\d:\d\d$/.test(draft.end) && draft.start !== draft.end ? shiftMinutes(draft.start, draft.end, Number(draft.breakMinutes) || 0) : 0;
  const count = draft.memberIds.length * draft.days.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="shift-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={() => setDraft(null)} />
      <div ref={ref} className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl">
        <h2 id="shift-title" className="text-lg font-semibold">{editing ? "Modifier l'horaire" : "Ajouter des horaires"}</h2>
        {!editing ? <p className="mt-1 text-sm text-muted">Choisissez une ou plusieurs personnes et un ou plusieurs jours : l&apos;horaire est ajouté pour chacun.</p> : null}

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">{editing ? "Personne" : "Personnes"}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map((m) => {
              const on = draft.memberIds.includes(m.id);
              return (
                <button key={m.id} type="button" role={editing ? "radio" : "checkbox"} aria-checked={on} onClick={() => toggle("memberIds", m.id)} className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent", on ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border hover:border-border-strong")}>
                  {m.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">{editing ? "Jour" : "Jours"}</legend>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const on = draft.days.includes(d);
              return (
                <button key={d} type="button" role={editing ? "radio" : "checkbox"} aria-checked={on} aria-label={dayLabel(d)} onClick={() => toggle("days", d)} className={cn("flex h-12 flex-col items-center justify-center rounded-lg border text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent", on ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border hover:border-border-strong")}>
                  <span>{DAY_SHORT[i]}</span>
                  <span className="font-semibold tabular-nums">{dayNum(d)}</span>
                </button>
              );
            })}
          </div>
          {!editing ? (
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <button type="button" className="font-medium text-accent hover:text-accent-hover" onClick={() => set({ days: days.slice(0, 5) })}>Lundi à vendredi</button>
              <button type="button" className="font-medium text-accent hover:text-accent-hover" onClick={() => set({ days: days.slice(0, 6) })}>Lundi à samedi</button>
              <button type="button" className="font-medium text-accent hover:text-accent-hover" onClick={() => set({ days: [] })}>Aucun</button>
            </div>
          ) : null}
        </fieldset>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="Horaires types">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => set({ start: p.start, end: p.end, breakMinutes: p.pause })} className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
              {p.label} <span className="text-muted tabular-nums">{p.start}–{p.end}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <Field label="Début" htmlFor="sh-start"><Input id="sh-start" type="time" value={draft.start} onChange={(e) => set({ start: e.target.value })} required /></Field>
          <Field label="Fin" htmlFor="sh-end"><Input id="sh-end" type="time" value={draft.end} onChange={(e) => set({ end: e.target.value })} required /></Field>
          <Field label="Pause (min)" htmlFor="sh-break"><Input id="sh-break" type="number" min={0} max={600} step={5} inputMode="numeric" value={draft.breakMinutes} onChange={(e) => set({ breakMinutes: e.target.value })} /></Field>
        </div>
        <p className="mt-1 text-xs text-muted">
          {minutes ? `${fmtHours(minutes)} de travail${overnight(draft.start, draft.end) ? ", jusqu'au lendemain" : ""}.` : "Indiquez l'heure de début et de fin."}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Poste ou lieu (facultatif)" htmlFor="sh-label"><Input id="sh-label" value={draft.label} maxLength={60} placeholder="Caisse, cuisine, chantier…" onChange={(e) => set({ label: e.target.value })} /></Field>
          <Field label="Note (facultatif)" htmlFor="sh-note"><Input id="sh-note" value={draft.note} maxLength={300} onChange={(e) => set({ note: e.target.value })} /></Field>
        </div>

        {error ? <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {onDelete ? <Button variant="ghost" className="text-danger sm:mr-auto" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={onDelete} disabled={pending}>Supprimer</Button> : <span className="sm:mr-auto" />}
          <Button variant="secondary" onClick={() => setDraft(null)} disabled={pending}>Annuler</Button>
          <Button onClick={onSubmit} loading={pending} disabled={!draft.memberIds.length || !draft.days.length}>
            {editing ? "Enregistrer" : count > 1 ? `Ajouter ${count} horaires` : "Ajouter"}
          </Button>
        </div>
      </div>
    </div>
  );
}

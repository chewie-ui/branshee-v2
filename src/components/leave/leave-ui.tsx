"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { LEAVE_KINDS, LEAVE_STATUS, PERIOD_LABEL, fmtDays, fmtRange, leaveHalfDays, type LeaveKind, type LeavePeriod } from "@/lib/leave";
import { cancelLeave, decideLeave, requestLeave, setAllowance, setAllowanceForAll } from "@/server/actions/leave";
import type { LeaveBalance, LeaveMember, LeaveView } from "@/server/leave";

type R = { ok: true; message?: string } | { ok: false; error: string };

function useAction() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const run = (key: string, fn: () => Promise<R>, after?: (r: R) => void) => {
    setBusy(key);
    start(async () => {
      const r = await fn().catch(() => ({ ok: false as const, error: "Une erreur est survenue. Réessayez." }));
      setBusy(null);
      setMsg(r.ok ? { ok: true, text: r.message ?? "C'est fait." } : { ok: false, text: r.error });
      after?.(r);
      if (r.ok) router.refresh();
    });
  };
  return { msg, setMsg, busy, run };
}

export function Notice({ msg }: { msg: { ok: boolean; text: string } | null }) {
  return msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null;
}

/** Bouton « Demander un congé » (ou « Encoder une absence » pour le responsable) et sa fenêtre. */
export function RequestLeaveButton({ members, me, canApprove, today }: { members: LeaveMember[]; me: string; canApprove: boolean; today: string }) {
  const [open, setOpen] = useState(false);
  const { msg, run, busy, setMsg } = useAction();
  const [f, setF] = useState({ memberId: me, kind: "conge" as LeaveKind, start: today, end: today, period: "full" as LeavePeriod, note: "" });
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>("select,input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const single = f.start === f.end;
  const half = f.start && f.end && f.end >= f.start ? leaveHalfDays(f.start, f.end, single ? f.period : "full") : 0;
  const forOther = canApprove && f.memberId !== me;
  return (
    <>
      <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => { setError(null); setMsg(null); setOpen(true); }}>{canApprove ? "Encoder une absence" : "Demander un congé"}</Button>
      {msg && !open ? <div className="mt-3"><Notice msg={msg} /></div> : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={() => setOpen(false)} />
          <div ref={ref} className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl">
            <h2 id="leave-title" className="text-lg font-semibold">{canApprove ? "Encoder une absence" : "Demander un congé"}</h2>
            <p className="mt-1 text-sm text-muted">{canApprove ? "Vous validez les congés : l'absence est enregistrée tout de suite." : "Votre responsable reçoit la demande et vous prévient de sa réponse."}</p>
            <div className="mt-5 space-y-4">
              {canApprove && members.length > 1 ? (
                <Field label="Personne" htmlFor="lv-member">
                  <Select id="lv-member" value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })}>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.isMe ? " (vous)" : ""}</option>)}
                  </Select>
                </Field>
              ) : null}
              <Field label="Type d'absence" htmlFor="lv-kind">
                <Select id="lv-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as LeaveKind })}>
                  {(Object.keys(LEAVE_KINDS) as LeaveKind[]).map((k) => <option key={k} value={k}>{LEAVE_KINDS[k].label}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Du" htmlFor="lv-start"><Input id="lv-start" type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value, end: f.end < e.target.value ? e.target.value : f.end })} required /></Field>
                <Field label="Au (inclus)" htmlFor="lv-end"><Input id="lv-end" type="date" value={f.end} min={f.start} onChange={(e) => setF({ ...f, end: e.target.value })} required /></Field>
              </div>
              {single ? (
                <div className="inline-flex rounded-lg bg-surface-muted p-1" role="radiogroup" aria-label="Durée">
                  {(["full", "am", "pm"] as LeavePeriod[]).map((p) => (
                    <button key={p} type="button" role="radio" aria-checked={f.period === p} onClick={() => setF({ ...f, period: p })} className={cn("h-8 rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent", f.period === p ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>{PERIOD_LABEL[p]}</button>
                  ))}
                </div>
              ) : null}
              <p className="text-sm text-muted">{half ? `${fmtDays(half)} ouvrable${half > 2 ? "s" : ""} (week-ends et jours fériés belges non comptés).` : "Aucun jour ouvrable sur cette période."}</p>
              <Field label={forOther ? "Note (facultatif)" : "Message au responsable (facultatif)"} htmlFor="lv-note"><Textarea id="lv-note" rows={2} maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
            </div>
            {error ? <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy === "req"}>Annuler</Button>
              <Button loading={busy === "req"} onClick={() => run("req", () => requestLeave({ memberId: f.memberId, kind: f.kind, start: f.start, end: f.end, period: f.period, note: f.note }), (r) => (r.ok ? setOpen(false) : setError(r.error)))}>
                {canApprove ? "Enregistrer" : "Envoyer la demande"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Demandes à valider (responsable) : valider, ou refuser avec un mot d'explication. */
export function PendingList({ items }: { items: LeaveView[] }) {
  const { msg, busy, run } = useAction();
  const [refusing, setRefusing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  if (!items.length && !msg) return null;
  return (
    <div className="space-y-3">
      {msg ? <div className="px-5 pt-4"><Notice msg={msg} /></div> : null}
      <ul className="divide-y divide-border">
        {items.map((l) => (
          <li key={l.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{l.memberName} <span className="font-normal text-muted">· {LEAVE_KINDS[l.kind].label}</span></p>
              <p className="text-sm text-muted">{fmtRange(l.start, l.end, l.period)} · {fmtDays(l.halfDays)}</p>
              {l.note ? <p className="mt-1 text-sm">« {l.note} »</p> : null}
              {refusing === l.id ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Raison du refus (facultatif)" maxLength={500} aria-label="Raison du refus" />
                  <Button variant="danger" size="sm" loading={busy === `r-${l.id}`} onClick={() => run(`r-${l.id}`, () => decideLeave(l.id, false, note), () => setRefusing(null))}>Refuser</Button>
                  <Button variant="ghost" size="sm" onClick={() => setRefusing(null)}>Annuler</Button>
                </div>
              ) : null}
            </div>
            {refusing !== l.id ? (
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" icon={<X className="size-4" aria-hidden="true" />} onClick={() => { setNote(""); setRefusing(l.id); }}>Refuser</Button>
                <Button size="sm" icon={<Check className="size-4" aria-hidden="true" />} loading={busy === `a-${l.id}`} onClick={() => run(`a-${l.id}`, () => decideLeave(l.id, true))}>Valider</Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Liste d'absences (à venir ou passées) avec annulation possible. */
export function LeaveList({ items, me, canApprove, today, showName }: { items: LeaveView[]; me: string; canApprove: boolean; today: string; showName: boolean }) {
  const { msg, busy, run } = useAction();
  const [confirm, setConfirm] = useState<LeaveView | null>(null);
  return (
    <>
      <Notice msg={msg} />
      <ul className="divide-y divide-border">
        {items.map((l) => {
          const st = LEAVE_STATUS[l.status];
          const cancellable = (l.status === "pending" || l.status === "approved") && (canApprove || (l.memberId === me && l.end >= today));
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-medium">{showName ? `${l.memberName} · ` : ""}{LEAVE_KINDS[l.kind].label}</p>
                <p className="text-sm text-muted">{fmtRange(l.start, l.end, l.period)} · {fmtDays(l.halfDays)}</p>
                {l.decisionNote ? <p className="mt-0.5 text-sm text-muted">Réponse : « {l.decisionNote} »</p> : null}
              </div>
              <Badge tone={st.tone}>{st.label}</Badge>
              {cancellable ? <Button variant="ghost" size="sm" onClick={() => setConfirm(l)}>Annuler</Button> : null}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog open={!!confirm} title="Annuler cette absence ?" confirmLabel="Annuler l'absence" danger loading={busy === "cancel"} onCancel={() => setConfirm(null)} onConfirm={() => confirm && run("cancel", () => cancelLeave(confirm.id), () => setConfirm(null))}>
        {confirm ? `${LEAVE_KINDS[confirm.kind].label} ${fmtRange(confirm.start, confirm.end, confirm.period)}. Les jours fermés dans l'agenda sont rouverts.` : null}
      </ConfirmDialog>
    </>
  );
}

/** Soldes de l'équipe (responsable) : jours par an modifiables, pris, prévus, en attente, restants. */
export function AllowanceTable({ year, members, balances }: { year: number; members: LeaveMember[]; balances: LeaveBalance[] }) {
  const { msg, busy, run } = useAction();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(balances.map((b) => [b.memberId, b.allowance === null ? "" : String(b.allowance / 2)])));
  const [all, setAll] = useState("20");
  return (
    <div className="space-y-4">
      <Notice msg={msg} />
      <div className="flex flex-wrap items-end gap-2 px-5 pt-4">
        <Field label={`Jours par an pour ceux qui n'ont pas encore de solde en ${year}`} htmlFor="lv-all" className="w-full max-w-xs">
          <Input id="lv-all" type="number" min={0} max={366} step={0.5} value={all} onChange={(e) => setAll(e.target.value)} />
        </Field>
        <Button variant="secondary" loading={busy === "all"} onClick={() => run("all", () => setAllowanceForAll(year, Number(all)))}>Appliquer à tous</Button>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-y border-border text-left text-muted">
            <tr>
              <th className="px-5 py-2.5 font-medium">Personne</th>
              <th className="px-3 py-2.5 font-medium">Jours par an</th>
              <th className="px-3 py-2.5 text-right font-medium">Pris</th>
              <th className="px-3 py-2.5 text-right font-medium">Prévus</th>
              <th className="px-3 py-2.5 text-right font-medium">En attente</th>
              <th className="px-5 py-2.5 text-right font-medium">Restant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => {
              const b = balances.find((x) => x.memberId === m.id) ?? { allowance: null, taken: 0, planned: 0, pending: 0 };
              const left = b.allowance === null ? null : b.allowance - b.taken - b.planned;
              const changed = (values[m.id] ?? "") !== (b.allowance === null ? "" : String(b.allowance / 2));
              return (
                <tr key={m.id}>
                  <td className="px-5 py-3 font-medium">{m.name}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Input type="number" min={0} max={366} step={0.5} className="w-24" value={values[m.id] ?? ""} placeholder="—" onChange={(e) => setValues({ ...values, [m.id]: e.target.value })} aria-label={`Jours par an pour ${m.name}`} />
                      {changed ? <Button size="sm" loading={busy === m.id} onClick={() => run(m.id, () => setAllowance(m.id, year, values[m.id] === "" ? null : Number(values[m.id])))}>OK</Button> : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtDays(b.taken).replace(" jours", " j").replace(" jour", " j")}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtDays(b.planned).replace(" jours", " j").replace(" jour", " j")}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{b.pending ? fmtDays(b.pending).replace(" jours", " j").replace(" jour", " j") : "—"}</td>
                  <td className={cn("px-5 py-3 text-right font-semibold tabular-nums", left !== null && left < 0 ? "text-danger" : "")}>{left === null ? "—" : `${String(left / 2).replace(".", ",")} j`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

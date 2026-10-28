"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Info, Lock, Pencil, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { shiftMonth } from "@/lib/payroll";
import { fmtMinutes, parseDuration } from "@/lib/projects";
import { savePayrollEntry, savePayrollProfile, setPayrollClosed } from "@/server/actions/payroll";
import type { PayrollRow } from "@/server/payroll";

type Res = { ok: boolean; message?: string; error?: string };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

export function PayrollBoard({ month, rows, closedAt }: { month: string; rows: PayrollRow[]; closedAt: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [profile, setProfile] = useState<PayrollRow | null>(null);
  const [entry, setEntry] = useState<PayrollRow | null>(null);
  const [pending, start] = useTransition();
  const label = new Intl.DateTimeFormat("fr-BE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
  const run = (fn: () => Promise<Res>, after?: () => void) => start(async () => { const r: Res = await fn().catch(() => ({ ok: false, error: "Action impossible." })); setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Fait.") : (r.error ?? "Action impossible.") }); if (r.ok) after?.(); router.refresh(); });
  const total = rows.reduce((a, r) => a + (r.gross ?? 0), 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/app/paie?mois=${shiftMonth(month, -1)}`} className="flex size-10 items-center justify-center rounded-lg border border-border-strong hover:bg-surface-muted" aria-label="Mois précédent"><ChevronLeft className="size-4" aria-hidden="true" /></Link>
        <h2 className="min-w-40 text-center text-lg font-semibold first-letter:uppercase">{label}</h2>
        <Link href={`/app/paie?mois=${shiftMonth(month, 1)}`} className="flex size-10 items-center justify-center rounded-lg border border-border-strong hover:bg-surface-muted" aria-label="Mois suivant"><ChevronRight className="size-4" aria-hidden="true" /></Link>
        {closedAt ? <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-sm font-medium text-success"><Lock className="size-3.5" aria-hidden="true" />Validé</span> : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <a href={`/app/paie/export?mois=${month}`} download className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted"><Download className="size-4" aria-hidden="true" />Export Excel</a>
          {closedAt ? <Button variant="ghost" loading={pending} icon={<Unlock className="size-4" aria-hidden="true" />} onClick={() => run(() => setPayrollClosed(month, false))}>Rouvrir</Button> : <Button loading={pending} icon={<Lock className="size-4" aria-hidden="true" />} onClick={() => run(() => setPayrollClosed(month, true))}>Valider le mois</Button>}
        </div>
      </div>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      <Card className="relative overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead><tr className="border-b border-border text-left text-xs text-muted"><th className="px-4 py-2.5">Personne</th><th className="px-2 py-2.5 text-right">Heures</th><th className="px-2 py-2.5 text-right">Contrat</th><th className="px-2 py-2.5 text-right">Jours</th><th className="px-2 py-2.5">Absences</th><th className="px-2 py-2.5 text-right">Chèques-repas</th><th className="px-2 py-2.5 text-right">Primes · km</th><th className="px-2 py-2.5 text-right">Brut indicatif</th><th className="px-2 py-2.5"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.memberId}>
                <td className="px-4 py-2.5"><span className="font-medium">{r.name}</span>{r.note ? <span className="block text-xs text-muted">{r.note}</span> : null}{!r.profile ? <button type="button" onClick={() => setProfile(r)} className="block text-xs font-medium text-accent hover:text-accent-hover">Renseigner le contrat</button> : null}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{fmtMinutes(r.minutes)}{r.adjustMinutes ? <span className="block text-xs text-muted">dont {r.adjustMinutes > 0 ? "+" : ""}{fmtMinutes(r.adjustMinutes)}</span> : null}</td>
                <td className={cn("px-2 py-2.5 text-right tabular-nums", r.contract !== null && r.minutes > r.contract && "text-warning")}>{r.contract !== null ? fmtMinutes(r.contract) : "—"}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{r.days}</td>
                <td className="px-2 py-2.5">{r.absences.length ? r.absences.map((a) => `${a.label} ${String(a.days).replace(".", ",")} j`).join(" · ") : <span className="text-muted">—</span>}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{r.profile?.mealVouchers ? r.mealVouchers : "—"}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{r.bonusCents ? eur(r.bonusCents) : "—"}{r.km ? <span className="block text-xs text-muted">{r.km} km</span> : null}</td>
                <td className="px-2 py-2.5 text-right font-medium tabular-nums">{r.gross !== null ? eur(r.gross) : "—"}</td>
                <td className="px-2 py-2.5 text-right whitespace-nowrap">
                  <button type="button" disabled={!!closedAt} onClick={() => setEntry(r)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:bg-surface-muted hover:text-text disabled:opacity-40" aria-label={`Ajuster le mois de ${r.name}`}><Pencil className="size-4" aria-hidden="true" />Ajuster</button>
                  <button type="button" onClick={() => setProfile(r)} className="inline-flex h-9 items-center rounded-lg px-2 text-sm text-muted hover:bg-surface-muted hover:text-text">Contrat</button>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length ? <tfoot><tr className="border-t border-border font-semibold"><td className="px-4 py-2.5" colSpan={7}>Total brut indicatif</td><td className="px-2 py-2.5 text-right tabular-nums">{eur(total)}</td><td /></tr></tfoot> : null}
        </table>
      </Card>
      <p className="flex max-w-prose gap-2 text-xs text-muted"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Heures reprises du Planning, absences validées dans Congés. Le brut est une estimation : les fiches de paie officielles (ONSS, précompte) sont calculées par votre secrétariat social à partir de l&apos;export.</p>
      {profile ? <ProfileDialog row={profile} onClose={() => setProfile(null)} onSave={(v) => run(() => savePayrollProfile({ memberId: profile.memberId, ...v }), () => setProfile(null))} pending={pending} /> : null}
      {entry ? <EntryDialog row={entry} onClose={() => setEntry(null)} onSave={(v) => run(() => savePayrollEntry({ memberId: entry.memberId, month, ...v }), () => setEntry(null))} pending={pending} /> : null}
    </div>
  );
}

function Dialog({ title, children, onClose, onSubmit }: { title: string; children: React.ReactNode; onClose: () => void; onSubmit: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="relative w-full max-w-md rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl" noValidate>
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </form>
    </div>
  );
}

function ProfileDialog({ row, onClose, onSave, pending }: { row: PayrollRow; onClose: () => void; onSave: (v: { weeklyHours: number; payType: "hourly" | "monthly"; rate: number; mealVouchers: boolean; externalId: string }) => void; pending: boolean }) {
  const p = row.profile;
  const [f, setF] = useState({ weekly: String((p?.weeklyMinutes ?? 2280) / 60).replace(".", ","), payType: (p?.payType ?? "hourly") as "hourly" | "monthly", rate: p ? String(p.rateCents / 100).replace(".", ",") : "", meal: p?.mealVouchers ?? false, ext: p?.externalId ?? "" });
  return (
    <Dialog title={`Contrat de ${row.name}`} onClose={onClose} onSubmit={() => onSave({ weeklyHours: Number(f.weekly.replace(",", ".")), payType: f.payType, rate: Number(f.rate.replace(",", ".") || 0), mealVouchers: f.meal, externalId: f.ext })}>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Heures par semaine" htmlFor="pp-week"><Input id="pp-week" inputMode="decimal" value={f.weekly} onChange={(e) => setF({ ...f, weekly: e.target.value })} /></Field>
        <Field label="Rémunération" htmlFor="pp-type"><Select id="pp-type" value={f.payType} onChange={(e) => setF({ ...f, payType: e.target.value as "hourly" | "monthly" })}><option value="hourly">À l&apos;heure</option><option value="monthly">Au mois</option></Select></Field>
        <Field label={f.payType === "hourly" ? "Taux horaire brut (€)" : "Salaire mensuel brut (€)"} htmlFor="pp-rate"><Input id="pp-rate" inputMode="decimal" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>
        <Field label="Matricule secrétariat social" htmlFor="pp-ext"><Input id="pp-ext" value={f.ext} onChange={(e) => setF({ ...f, ext: e.target.value })} maxLength={40} /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.meal} onChange={(e) => setF({ ...f, meal: e.target.checked })} className="size-4" />Chèques-repas (un par jour presté)</label>
      </div>
      <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" loading={pending}>Enregistrer</Button></div>
    </Dialog>
  );
}

function EntryDialog({ row, onClose, onSave, pending }: { row: PayrollRow; onClose: () => void; onSave: (v: { adjustMinutes: number; bonus: number; km: number; note: string }) => void; pending: boolean }) {
  const [f, setF] = useState({ sign: row.adjustMinutes < 0 ? "-" : "+", adj: row.adjustMinutes ? fmtMinutes(Math.abs(row.adjustMinutes)).replace(/\s/g, "") : "", bonus: row.bonusCents ? String(row.bonusCents / 100).replace(".", ",") : "", km: row.km ? String(row.km) : "", note: row.note });
  const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog title={`Ajuster le mois de ${row.name}`} onClose={onClose} onSubmit={() => { const m = f.adj.trim() ? parseDuration(f.adj.replace("min", "m")) : 0; if (m === null) return setErr("Heures non comprises (ex. : 2h30)."); onSave({ adjustMinutes: (f.sign === "-" ? -1 : 1) * m, bonus: Number(f.bonus.replace(",", ".") || 0), km: Number(f.km || 0), note: f.note }); }}>
      <p className="mt-1 text-sm text-muted">Planning : {fmtMinutes(row.plannedMinutes)} sur {row.days} jour{row.days > 1 ? "s" : ""}.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Heures en plus / en moins" htmlFor="pe-adj"><div className="flex gap-1"><Select aria-label="Sens" value={f.sign} onChange={(e) => setF({ ...f, sign: e.target.value })} className="w-16"><option value="+">+</option><option value="-">−</option></Select><Input id="pe-adj" value={f.adj} onChange={(e) => setF({ ...f, adj: e.target.value })} placeholder="2h30" /></div></Field>
        <Field label="Primes brutes (€)" htmlFor="pe-bonus"><Input id="pe-bonus" inputMode="decimal" value={f.bonus} onChange={(e) => setF({ ...f, bonus: e.target.value })} /></Field>
        <Field label="Kilomètres" htmlFor="pe-km"><Input id="pe-km" inputMode="numeric" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value.replace(/\D/g, "") })} /></Field>
        <Field label="Remarque pour le secrétariat" htmlFor="pe-note"><Input id="pe-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} /></Field>
      </div>
      {err ? <p className="mt-3 text-sm text-danger" role="alert">{err}</p> : null}
      <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" loading={pending}>Enregistrer</Button></div>
    </Dialog>
  );
}

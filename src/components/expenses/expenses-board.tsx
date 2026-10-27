"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Paperclip, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { EXPENSE_CATEGORIES, vatFromGross } from "@/lib/expenses";
import { deleteExpense, saveExpense } from "@/server/actions/expenses";

export type ExpenseRow = { id: string; date: string; supplier: string | null; category: string; description: string | null; amountCents: number; vatCents: number; proofName: string | null; hasProof: boolean };

const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);
const fdate = (d: string) => new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00Z`));

/** Dépenses de l'année : liste, totaux, répartition par catégorie, justificatifs manquants, export. */
export function ExpensesBoard({ year, years, rows, canManage, franchise, today }: { year: number; years: number[]; rows: ExpenseRow[]; canManage: boolean; franchise: boolean; today: string }) {
  const router = useRouter();
  const [edit, setEdit] = useState<ExpenseRow | "new" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const total = rows.reduce((a, r) => a + r.amountCents, 0);
  const vat = rows.reduce((a, r) => a + r.vatCents, 0);
  const missing = rows.filter((r) => !r.hasProof).length;
  const byCat = new Map<string, number>();
  for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amountCents - r.vatCents);
  const cats = [...byCat].sort((a, b) => b[1] - a[1]);
  const max = cats[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-surface-muted p-1" role="group" aria-label="Année">
          {years.map((y) => (
            <Link key={y} href={`/app/depenses?annee=${y}`} aria-current={y === year ? "page" : undefined} className={cn("h-8 rounded-md px-3 text-sm leading-8 font-medium", y === year ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>{y}</Link>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          {/* Téléchargement : lien classique (pas de navigation de l'app vers la route d'export). */}
          <a href={`/app/depenses/export?annee=${year}`} download className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><Download className="size-4" aria-hidden="true" />Exporter (CSV)</a>
          {canManage ? <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => { setMsg(null); setEdit("new"); }}>Nouvelle dépense</Button> : null}
        </div>
      </div>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-sm text-muted">Total {year}</p><p className="mt-1 text-xl font-semibold tabular-nums">{eur(total)}</p><p className="text-xs text-muted">{rows.length} dépense{rows.length > 1 ? "s" : ""}, TVA comprise</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Hors TVA</p><p className="mt-1 text-xl font-semibold tabular-nums">{eur(total - vat)}</p><p className="text-xs text-muted">Ce qui réduit votre bénéfice</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">{franchise ? "TVA payée" : "TVA récupérable"}</p><p className="mt-1 text-xl font-semibold tabular-nums">{eur(vat)}</p><p className="text-xs text-muted">{franchise ? "Non récupérable en franchise" : "À déduire dans votre déclaration TVA"}</p></Card>
      </div>
      {missing ? <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning"><Paperclip className="mr-1.5 inline size-4" aria-hidden="true" />{missing} dépense{missing > 1 ? "s" : ""} sans justificatif. Gardez une preuve pour chaque frais, votre comptable vous la demandera.</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="overflow-hidden">
          {rows.length ? (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" disabled={!canManage} onClick={() => { setMsg(null); setEdit(r); }} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors enabled:hover:bg-surface-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-default">
                    <span className="w-14 shrink-0 text-sm text-muted tabular-nums">{fdate(r.date)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.supplier || r.category}</span>
                      <span className="block truncate text-sm text-muted">{r.description || r.category}</span>
                    </span>
                    {r.hasProof ? <Paperclip className="size-4 shrink-0 text-muted" aria-label="Justificatif joint" /> : <span className="shrink-0 rounded bg-warning-soft px-1.5 text-[11px] font-semibold text-warning">Sans preuve</span>}
                    <span className="w-24 shrink-0 text-right font-medium tabular-nums">{eur(r.amountCents)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-8 text-center">
              <p className="font-medium">Aucune dépense en {year}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Notez chaque achat pro avec son justificatif (photo du ticket ou PDF) : c&apos;est ce qui réduit votre bénéfice imposable.</p>
              {canManage ? <Button className="mt-4" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEdit("new")}>Ajouter une dépense</Button> : null}
            </div>
          )}
        </Card>
        {cats.length ? (
          <Card>
            <CardHeader title="Par catégorie" description="Hors TVA" />
            <ul className="space-y-3 p-5">
              {cats.map(([c, v]) => (
                <li key={c}>
                  <div className="flex justify-between gap-2 text-sm"><span className="truncate">{c}</span><span className="tabular-nums">{eur(v)}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, (v / max) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      {edit ? <ExpenseDialog row={edit === "new" ? null : edit} franchise={franchise} today={today} onClose={() => setEdit(null)} onDone={(text) => { setEdit(null); setMsg({ ok: true, text }); router.refresh(); }} /> : null}
    </div>
  );
}

function ExpenseDialog({ row, franchise, today, onClose, onDone }: { row: ExpenseRow | null; franchise: boolean; today: string; onClose: () => void; onDone: (text: string) => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(row ? String(row.amountCents / 100) : "");
  const [vat, setVat] = useState(row ? String(row.vatCents / 100) : "");
  const [file, setFile] = useState<string | null>(null);
  const [removeProof, setRemoveProof] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const gross = Math.round((Number(amount.replace(",", ".")) || 0) * 100);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("amount", amount.replace(",", "."));
    fd.set("vat", franchise ? "0" : vat.replace(",", ".") || "0");
    if (removeProof) fd.set("removeProof", "1");
    start(async () => {
      setError(null);
      const r = await saveExpense(fd).catch(() => ({ ok: false as const, error: "Envoi impossible. Vérifiez votre connexion et réessayez." }));
      if (!r.ok) return setError(r.error);
      onDone(r.message ?? "Enregistré.");
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="exp-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <form ref={ref} onSubmit={submit} className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl" noValidate>
        <h2 id="exp-title" className="text-lg font-semibold">{row ? "Modifier la dépense" : "Nouvelle dépense"}</h2>
        {row ? <input type="hidden" name="id" value={row.id} /> : null}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="ex-date"><Input id="ex-date" name="date" type="date" defaultValue={row?.date ?? today} required /></Field>
          <Field label="Montant payé (TVAC)" htmlFor="ex-amount"><Input id="ex-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required /></Field>
          <Field label="Fournisseur" htmlFor="ex-supplier"><Input id="ex-supplier" name="supplier" defaultValue={row?.supplier ?? ""} maxLength={120} placeholder="Ex. : Proximus, Brico…" /></Field>
          <Field label="Catégorie" htmlFor="ex-cat">
            <Select id="ex-cat" name="category" defaultValue={row?.category ?? EXPENSE_CATEGORIES[0]}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          {!franchise ? (
            <div className="sm:col-span-2">
              <Field label="Dont TVA" htmlFor="ex-vat"><Input id="ex-vat" inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} placeholder="0,00" /></Field>
              <div className="mt-2 flex flex-wrap gap-2">
                {[21, 12, 6].map((rate) => (
                  <button key={rate} type="button" disabled={!gross} onClick={() => setVat((vatFromGross(gross, rate) / 100).toFixed(2).replace(".", ","))} className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent hover:text-accent disabled:opacity-40">TVA {rate} %</button>
                ))}
                <button type="button" onClick={() => setVat("0")} className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent hover:text-accent">Sans TVA</button>
              </div>
            </div>
          ) : null}
          <Field label="Description (facultatif)" htmlFor="ex-desc" className="sm:col-span-2"><Input id="ex-desc" name="description" defaultValue={row?.description ?? ""} maxLength={300} /></Field>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium">Justificatif</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label htmlFor="ex-file" className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted focus-within:outline-2 focus-within:outline-accent">
              <Upload className="size-4" aria-hidden="true" />{row?.hasProof || file ? "Remplacer" : "Photo du ticket ou PDF"}
            </label>
            <input id="ex-file" name="proof" type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0]?.name ?? null); setRemoveProof(false); }} />
            <span className="text-sm text-muted">{file ?? (row?.hasProof && !removeProof ? row.proofName : "Aucun fichier")}</span>
            {row?.hasProof && !file && !removeProof ? (
              <>
                <a href={`/app/depenses/${row.id}/justificatif`} target="_blank" rel="noopener" className="text-sm font-medium text-accent hover:text-accent-hover">Voir</a>
                <button type="button" className="text-sm font-medium text-danger" onClick={() => setRemoveProof(true)}>Retirer</button>
              </>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">10 Mo maximum. Le fichier est chiffré sur nos serveurs.</p>
        </div>
        {error ? <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {row ? <Button type="button" variant="ghost" className="text-danger sm:mr-auto" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)} disabled={pending}>Supprimer</Button> : <span className="sm:mr-auto" />}
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button type="submit" loading={pending}>Enregistrer</Button>
        </div>
      </form>
      <ConfirmDialog open={confirm} title="Supprimer cette dépense ?" confirmLabel="Supprimer" danger loading={pending} onCancel={() => setConfirm(false)} onConfirm={() => row && start(async () => { const r = await deleteExpense(row.id); if (!r.ok) { setConfirm(false); return setError(r.error); } onDone(r.message ?? "Supprimée."); })}>
        La dépense et son justificatif sont supprimés définitivement.
      </ConfirmDialog>
    </div>
  );
}

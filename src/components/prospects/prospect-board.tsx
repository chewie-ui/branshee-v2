"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, MapPin, Pencil, Phone, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { MAX_ATTEMPTS, PROSPECT_STATUS, isProspectStatus } from "@/lib/prospects";
import { deleteProspect, reopenProspect, saveProspect } from "@/server/actions/prospects";
import type { ProspectView } from "@/server/prospects";

type Res = { ok: boolean; message?: string; error?: string };
export const telHref = (p: string) => `tel:${p.replace(/[^+0-9]/g, "")}`;

export function statusBadge(p: Pick<ProspectView, "status" | "attempts">) {
  if (p.status === "no_answer" && p.attempts >= MAX_ATTEMPTS) return <Badge tone="neutral">Injoignable</Badge>;
  const s = isProspectStatus(p.status) ? PROSPECT_STATUS[p.status] : PROSPECT_STATUS.todo;
  return <Badge tone={s.tone}>{s.label}{p.status === "no_answer" && p.attempts > 1 ? ` (${p.attempts})` : ""}</Badge>;
}

/** Liste des prospects : ajouter, modifier, appeler, remettre dans la file, supprimer. */
export function ProspectBoard({ rows, canManage, filtered }: { rows: ProspectView[]; canManage: boolean; filtered: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState<ProspectView | "new" | null>(null);
  const [del, setDel] = useState<ProspectView | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>, after?: () => void) =>
    start(async () => {
      const r: Res = await fn().catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion." }));
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Fait.") : (r.error ?? "Action impossible.") });
      if (r.ok) after?.();
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      {canManage ? (
        <div>
          <Button variant="secondary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => { setMsg(null); setEdit("new"); }}>Ajouter un prospect</Button>
        </div>
      ) : null}

      {!rows.length ? (
        <Card className="p-10 text-center">
          <Users className="mx-auto size-8 text-muted" aria-hidden="true" />
          <p className="mt-3 font-medium">{filtered ? "Aucun prospect ne correspond." : "Votre liste est vide."}</p>
          <p className="mt-1 text-sm text-muted">{filtered ? "Essayez un autre filtre ou une autre recherche." : "Ajoutez les pros ou les particuliers à démarcher, un par un ou en important un fichier Excel."}</p>
        </Card>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1 basis-60">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.company || p.name}</span>
                  {statusBadge(p)}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
                  {p.company && p.name !== p.company ? <span>{p.name}</span> : null}
                  {p.trade ? <span>{p.trade}</span> : null}
                  {p.city ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{p.city}</span> : null}
                  {p.refuseReason ? <span>Refus : {p.refuseReason}</span> : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {p.phone ? <a href={telHref(p.phone)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-accent hover:bg-accent-soft"><Phone className="size-4" aria-hidden="true" />{p.phone}</a> : null}
                {!p.phone && p.email ? <a href={`mailto:${p.email}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-accent hover:bg-accent-soft"><Mail className="size-4" aria-hidden="true" />{p.email}</a> : null}
                {p.dealId ? <Link href={`/app/ventes?piste=${p.dealId}`} className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-success hover:bg-success-soft">Voir la piste<ArrowRight className="size-4" aria-hidden="true" /></Link> : null}
                {canManage ? (
                  <>
                    {["refused", "invalid", "do_not_call", "interested"].includes(p.status) || (p.status === "no_answer" && p.attempts >= MAX_ATTEMPTS) ? (
                      <button type="button" disabled={pending} onClick={() => run(() => reopenProspect(p.id))} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label={`Remettre ${p.name} dans la liste à appeler`} title="Remettre dans la liste à appeler"><RotateCcw className="size-4" aria-hidden="true" /></button>
                    ) : null}
                    <button type="button" onClick={() => { setMsg(null); setEdit(p); }} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label={`Modifier ${p.name}`}><Pencil className="size-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => setDel(p)} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Supprimer ${p.name}`}><Trash2 className="size-4" aria-hidden="true" /></button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length >= 500 ? <p className="text-sm text-muted">Les 500 derniers modifiés sont affichés : utilisez la recherche pour trouver les autres.</p> : null}

      {edit ? <ProspectDialog initial={edit === "new" ? null : edit} onClose={() => setEdit(null)} onDone={(t) => { setEdit(null); setMsg({ ok: true, text: t }); router.refresh(); }} /> : null}
      <ConfirmDialog open={!!del} title={`Supprimer ${del?.company || del?.name || ""} ?`} confirmLabel="Supprimer" danger loading={pending} onCancel={() => setDel(null)} onConfirm={() => del && run(() => deleteProspect(del.id), () => setDel(null))}>
        Le prospect et l&apos;historique de ses appels sont supprimés. Une piste déjà créée dans Ventes reste.
      </ConfirmDialog>
    </div>
  );
}

export function ProspectDialog({ initial, onClose, onDone }: { initial: ProspectView | null; onClose: () => void; onDone: (text: string) => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [f, setF] = useState({ name: initial?.name ?? "", company: initial?.company ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "", city: initial?.city ?? "", trade: initial?.trade ?? "", note: initial?.note ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const r: Res = await saveProspect({ id: initial?.id, ...f }).catch(() => ({ ok: false, error: "Envoi impossible. Vérifiez votre connexion." }));
      if (!r.ok) return setError(r.error ?? "Envoi impossible.");
      onDone(r.message ?? "Enregistré.");
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pr-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <form ref={ref} onSubmit={submit} className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl" noValidate>
        <h2 id="pr-title" className="text-lg font-semibold">{initial ? "Modifier le prospect" : "Nouveau prospect"}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nom" htmlFor="pr-name"><Input id="pr-name" value={f.name} onChange={set("name")} maxLength={120} required placeholder="Jean Dupont" /></Field>
          <Field label="Entreprise (facultatif)" htmlFor="pr-company"><Input id="pr-company" value={f.company} onChange={set("company")} maxLength={120} placeholder="Salon Jean" /></Field>
          <Field label="Téléphone" htmlFor="pr-phone"><Input id="pr-phone" type="tel" value={f.phone} onChange={set("phone")} maxLength={40} placeholder="0470 12 34 56" /></Field>
          <Field label="Email" htmlFor="pr-email"><Input id="pr-email" type="email" value={f.email} onChange={set("email")} maxLength={200} /></Field>
          <Field label="Ville" htmlFor="pr-city"><Input id="pr-city" value={f.city} onChange={set("city")} maxLength={80} /></Field>
          <Field label="Métier ou secteur" htmlFor="pr-trade"><Input id="pr-trade" value={f.trade} onChange={set("trade")} maxLength={80} placeholder="Coiffeur, restaurant…" /></Field>
          <Field label="Note" htmlFor="pr-note" className="sm:col-span-2"><Textarea id="pr-note" rows={3} value={f.note} onChange={set("note")} maxLength={2000} placeholder="Où vous l'avez trouvé, ce qu'il faut savoir avant d'appeler…" /></Field>
        </div>
        {error ? <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button type="submit" loading={pending}>Enregistrer</Button>
        </div>
      </form>
    </div>
  );
}

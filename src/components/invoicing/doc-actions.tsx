"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, FileMinus, FileText, Pencil, RotateCcw, Send, Trash2, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PAID_METHODS, type DocState, type DocType } from "@/lib/invoicing";
import { createCreditNote, deleteDocument, duplicateDocument, issueDocument, markPaid, quoteToInvoice, setQuoteStatus, unmarkPaid } from "@/server/actions/invoicing";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";

type R = { ok: true; id?: string; message?: string } | { ok: false; error: string };

/** Actions d'un document selon son type et son état (comme la fiche de Comptoir). */
export function DocActions({ id, docType, state, today, mail, reminder, canManage }: { id: string; docType: DocType; state: DocState; today: string; mail: string; reminder: string | null; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<null | "issue" | "delete">(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState({ date: today, method: "Virement" });

  const run = (fn: () => Promise<R>, goTo?: (r: { id?: string }) => string | null) =>
    start(async () => {
      const r = await fn();
      setConfirm(null);
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setMsg(r.message ? { ok: true, text: r.message } : null);
      const dest = goTo?.(r);
      if (dest) router.push(dest);
      router.refresh();
    });
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ ok: true, text: label });
    } catch {
      setMsg({ ok: false, text: "Copie impossible dans ce navigateur." });
    }
  };

  const isQuote = docType === "quote";
  const draft = !isQuote && state === "draft";
  const pdf = <ButtonLink href={`/imprimer/factures/${id}`} target="_blank" variant="secondary" icon={<Download className="size-4" aria-hidden="true" />}>PDF</ButtonLink>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!canManage ? pdf : null}
        {canManage && draft ? (
          <>
            <ButtonLink href={`/app/factures/${id}/modifier`} variant="secondary" icon={<Pencil className="size-4" aria-hidden="true" />}>Modifier</ButtonLink>
            <Button icon={<Send className="size-4" aria-hidden="true" />} onClick={() => setConfirm("issue")} disabled={pending}>Émettre</Button>
            <Button variant="ghost" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm("delete")} disabled={pending}>Supprimer</Button>
          </>
        ) : null}
        {canManage && !isQuote && !draft ? (
          <>
            {pdf}
            {state === "open" || state === "overdue" ? <Button icon={<Check className="size-4" aria-hidden="true" />} onClick={() => setPaying((v) => !v)}>Marquer comme payée</Button> : null}
            {state === "paid" ? <Button variant="secondary" icon={<RotateCcw className="size-4" aria-hidden="true" />} loading={pending} onClick={() => run(() => unmarkPaid(id))}>Annuler l&apos;encaissement</Button> : null}
            <Button variant="ghost" icon={<Copy className="size-4" aria-hidden="true" />} onClick={() => copy(mail, "Message d'envoi copié : collez-le dans votre email avec le PDF.")}>Copier le message</Button>
            {reminder ? <Button variant="ghost" icon={<Send className="size-4" aria-hidden="true" />} onClick={() => copy(reminder, "Message de relance copié.")}>Copier une relance</Button> : null}
            {docType === "invoice" && state !== "cancelled" ? <Button variant="ghost" icon={<FileMinus className="size-4" aria-hidden="true" />} loading={pending} onClick={() => run(() => createCreditNote(id), (r) => (r.id ? `/app/factures/${r.id}/modifier` : null))}>Note de crédit</Button> : null}
            <Button variant="ghost" icon={<Copy className="size-4" aria-hidden="true" />} loading={pending} onClick={() => run(() => duplicateDocument(id), (r) => (r.id ? `/app/factures/${r.id}/modifier` : null))}>Dupliquer</Button>
          </>
        ) : null}
        {canManage && isQuote ? (
          <>
            {state === "invoiced" ? (
              <Button icon={<FileText className="size-4" aria-hidden="true" />} loading={pending} onClick={() => run(() => quoteToInvoice(id), (r) => (r.id ? `/app/factures/${r.id}` : null))}>Voir la facture</Button>
            ) : (
              <Button icon={<FileText className="size-4" aria-hidden="true" />} loading={pending} onClick={() => run(() => quoteToInvoice(id), (r) => (r.id ? `/app/factures/${r.id}/modifier` : null))}>Transformer en facture</Button>
            )}
            {pdf}
            {state !== "invoiced" ? <ButtonLink href={`/app/factures/${id}/modifier`} variant="secondary" icon={<Pencil className="size-4" aria-hidden="true" />}>Modifier</ButtonLink> : null}
            {state === "draft" ? <Button variant="ghost" icon={<Send className="size-4" aria-hidden="true" />} loading={pending} onClick={() => run(() => setQuoteStatus(id, "sent"))}>Marquer comme envoyé</Button> : null}
            {["draft", "sent", "expired"].includes(state) ? (
              <>
                <Button variant="ghost" icon={<Check className="size-4" aria-hidden="true" />} loading={pending} onClick={() => run(() => setQuoteStatus(id, "accepted"))}>Accepté</Button>
                <Button variant="ghost" icon={<X className="size-4" aria-hidden="true" />} loading={pending} onClick={() => run(() => setQuoteStatus(id, "refused"))}>Refusé</Button>
              </>
            ) : null}
            <Button variant="ghost" icon={<Copy className="size-4" aria-hidden="true" />} onClick={() => copy(mail, "Message d'envoi copié.")}>Copier le message</Button>
            <Button variant="ghost" icon={<Copy className="size-4" aria-hidden="true" />} loading={pending} onClick={() => run(() => duplicateDocument(id), (r) => (r.id ? `/app/factures/${r.id}` : null))}>Dupliquer</Button>
            {state !== "invoiced" ? <Button variant="ghost" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm("delete")}>Supprimer</Button> : null}
          </>
        ) : null}
      </div>

      {paying ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
          <Field label="Payée le" htmlFor="paid-date">
            <Input id="paid-date" type="date" value={paid.date} onChange={(e) => setPaid((p) => ({ ...p, date: e.target.value }))} />
          </Field>
          <Field label="Moyen" htmlFor="paid-method">
            <Select id="paid-method" value={paid.method} onChange={(e) => setPaid((p) => ({ ...p, method: e.target.value }))}>
              {PAID_METHODS.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <Button loading={pending} onClick={() => { setPaying(false); run(() => markPaid(id, paid)); }}>Confirmer le paiement</Button>
        </div>
      ) : null}

      {msg ? <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}

      <ConfirmDialog open={confirm === "issue"} title="Émettre ce document ?" confirmLabel="Émettre" loading={pending} onCancel={() => setConfirm(null)} onConfirm={() => run(() => issueDocument(id))}>
        Il recevra son numéro définitif et ne pourra plus être modifié ni supprimé. Pour corriger une erreur, vous ferez une note de crédit.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "delete"} title="Supprimer ce document ?" confirmLabel="Supprimer" danger loading={pending} onCancel={() => setConfirm(null)} onConfirm={() => run(() => deleteDocument(id), () => (isQuote ? "/app/factures/devis" : "/app/factures/liste"))}>
        Cette action est définitive.
      </ConfirmDialog>
    </div>
  );
}

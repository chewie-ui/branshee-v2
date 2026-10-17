"use client";

import { useActionState, useState, useTransition } from "react";
import { Ban, CheckSquare, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/field";
import { submitKeepingValues } from "@/lib/form";
import { deleteNote, saveCustomer, saveNote, setCustomerBlocked, type CustomerState } from "@/server/actions/customers";

export type NoteView = { id: string; date: string; dateLabel: string; title: string; note: string; todo: string; author: string | null };

function NoteEditor({ customerId, note, today, onDone }: { customerId: string; note: NoteView | null; today: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-surface-muted/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const input = Object.fromEntries(["date", "title", "note", "todo"].map((k) => [k, String(fd.get(k) ?? "")]));
        start(async () => {
          const res = await saveNote(customerId, note?.id ?? null, input);
          if (res?.ok) onDone();
          else setError(res?.error ?? "Erreur.");
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <Field label="Date" htmlFor={`d-${note?.id ?? "new"}`}>
          <Input id={`d-${note?.id ?? "new"}`} name="date" type="date" defaultValue={note?.date ?? today} />
        </Field>
        <Field label="Titre" htmlFor={`t-${note?.id ?? "new"}`}>
          <Input id={`t-${note?.id ?? "new"}`} name="title" defaultValue={note?.title} placeholder="Séance 3, bilan…" maxLength={120} />
        </Field>
      </div>
      <Field label="Note" htmlFor={`n-${note?.id ?? "new"}`}>
        <Textarea id={`n-${note?.id ?? "new"}`} name="note" defaultValue={note?.note} rows={4} maxLength={10000} />
      </Field>
      <Field label="À faire" htmlFor={`o-${note?.id ?? "new"}`}>
        <Input id={`o-${note?.id ?? "new"}`} name="todo" defaultValue={note?.todo} placeholder="Exercices à donner, rappel…" maxLength={2000} />
      </Field>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>Annuler</Button>
        <Button type="submit" size="sm" loading={pending}>Enregistrer la note</Button>
      </div>
    </form>
  );
}

export function DossierNotes({ customerId, notes, canManage, today }: { customerId: string; notes: NoteView[]; canManage: boolean; today: string }) {
  const [editing, setEditing] = useState<string | null>(null); // id de note, "new" ou null
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [, startDelete] = useTransition();
  return (
    <Card>
      <CardHeader
        title="Dossier"
        description="Notes de suivi, visibles par l'équipe uniquement. Chiffrées en base."
        action={canManage && editing !== "new" ? <Button size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing("new")}>Ajouter une note</Button> : null}
      />
      <div className="space-y-3 p-5">
        {editing === "new" ? <NoteEditor customerId={customerId} note={null} today={today} onDone={() => setEditing(null)} /> : null}
        {notes.length === 0 && editing !== "new" ? (
          <EmptyState icon={<NotebookPen />} title="Aucune note" description="Consignez ici le suivi de chaque séance." />
        ) : (
          <ul className="space-y-3">
            {notes.map((n) =>
              editing === n.id ? (
                <li key={n.id}><NoteEditor customerId={customerId} note={n} today={today} onDone={() => setEditing(null)} /></li>
              ) : (
                <li key={n.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{n.title || "Note"}</p>
                      <p className="text-xs text-muted">{n.dateLabel}{n.author ? ` · ${n.author}` : ""}</p>
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => setEditing(n.id)} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label="Modifier la note"><Pencil className="size-4" aria-hidden="true" /></button>
                        {confirmDelete === n.id ? (
                          <>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Garder</Button>
                            <Button type="button" size="sm" variant="danger" onClick={() => startDelete(async () => void (await deleteNote(customerId, n.id)))}>Supprimer</Button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setConfirmDelete(n.id)} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label="Supprimer la note"><Trash2 className="size-4" aria-hidden="true" /></button>
                        )}
                      </div>
                    ) : null}
                  </div>
                  {n.note ? <p className="mt-2 text-sm whitespace-pre-line">{n.note}</p> : null}
                  {n.todo ? (
                    <p className="mt-2 flex items-start gap-2 rounded-md bg-warning-soft px-2.5 py-1.5 text-sm text-warning">
                      <CheckSquare className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      {n.todo}
                    </p>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </Card>
  );
}

type Contact = { fullName: string; email: string; phone: string; altName: string; altPhone: string; generalInfo: string; blocked: boolean; blockedReason: string };

export function CustomerDetailsForm({ customerId, c }: { customerId: string; c: Contact }) {
  const [state, action, pending] = useActionState<CustomerState, FormData>(saveCustomer.bind(null, customerId), undefined);
  const [blocking, startBlock] = useTransition();
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState("");
  const err = state?.fieldErrors ?? {};
  return (
    <Card>
      <CardHeader title="Fiche" />
      <form onSubmit={submitKeepingValues(action)} className="space-y-4 p-5" noValidate>
        <Field label="Nom" htmlFor="fullName" error={err.fullName}><Input id="fullName" name="fullName" defaultValue={c.fullName} maxLength={120} /></Field>
        <Field label="Email" htmlFor="email" error={err.email}><Input id="email" name="email" type="email" defaultValue={c.email} /></Field>
        <Field label="Téléphone" htmlFor="phone"><Input id="phone" name="phone" type="tel" defaultValue={c.phone} /></Field>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Field label="Contact secondaire" htmlFor="altName"><Input id="altName" name="altName" defaultValue={c.altName} placeholder="Parent, conjoint…" /></Field>
          <Field label="Son téléphone" htmlFor="altPhone"><Input id="altPhone" name="altPhone" type="tel" defaultValue={c.altPhone} /></Field>
        </div>
        <Field label="Informations générales" htmlFor="generalInfo" hint="Antécédents, allergies, préférences… Chiffré en base.">
          <Textarea id="generalInfo" name="generalInfo" defaultValue={c.generalInfo} rows={4} maxLength={5000} />
        </Field>
        {state?.error ? <p className="text-sm text-danger" role="alert">{state.error}</p> : state?.ok ? <p className="text-sm text-success" role="status">Enregistré.</p> : null}
        {askReason ? (
          <div className="space-y-2 rounded-lg border border-danger/30 bg-danger-soft p-3">
            <label htmlFor="blockReason" className="block text-sm font-medium text-danger">Le client ne pourra plus réserver en ligne. Motif (facultatif) :</label>
            <Input id="blockReason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAskReason(false)}>Annuler</Button>
              <Button type="button" variant="danger" size="sm" loading={blocking} onClick={() => startBlock(async () => { await setCustomerBlocked(customerId, true, reason); setAskReason(false); })}>Bloquer</Button>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={blocking && !askReason}
            className={c.blocked ? "" : "text-danger hover:text-danger"}
            icon={<Ban className="size-4" aria-hidden="true" />}
            onClick={() => (c.blocked ? startBlock(async () => void (await setCustomerBlocked(customerId, false, ""))) : setAskReason(true))}
          >
            {c.blocked ? "Débloquer" : "Bloquer les réservations"}
          </Button>
          <Button type="submit" size="sm" loading={pending}>Enregistrer</Button>
        </div>
      </form>
    </Card>
  );
}

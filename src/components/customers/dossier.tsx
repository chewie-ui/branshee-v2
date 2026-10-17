"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckSquare, Download, ExternalLink, FileText, NotebookPen, Paperclip, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/field";
import { deleteNote, saveNote } from "@/server/actions/customers";

export type NoteView = { id: string; date: string; dateLabel: string; title: string; note: string; todo: string; author: string | null; file: { name: string; size: number | null } | null };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const kb = (n: number | null) => (n ? (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`) : "");

function NoteEditor({ customerId, note, today, onDone }: { customerId: string; note: NoteView | null; today: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const k = note?.id ?? "new";
  const existing = note?.file && !removeFile ? note.file : null;

  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-surface-muted/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (file) fd.set("file", file);
        else fd.delete("file");
        if (removeFile) fd.set("removeFile", "1");
        start(async () => {
          const res = await saveNote(customerId, note?.id ?? null, fd);
          if (res?.ok) onDone();
          else setError(res?.error ?? "Erreur.");
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <Field label="Date" htmlFor={`d-${k}`}>
          <Input id={`d-${k}`} name="date" type="date" defaultValue={note?.date ?? today} />
        </Field>
        <Field label="Titre (facultatif)" htmlFor={`t-${k}`}>
          <Input id={`t-${k}`} name="title" defaultValue={note?.title} placeholder="Ex. bilan initial, ordonnance…" maxLength={120} />
        </Field>
      </div>
      <Field label="Constat / ce qui a été fait" htmlFor={`n-${k}`}>
        <Textarea id={`n-${k}`} name="note" defaultValue={note?.note} rows={4} maxLength={10000} placeholder="Ex. douleur à l'épaule droite, amplitude limitée…" />
      </Field>
      <Field label="À faire au prochain rendez-vous (facultatif)" htmlFor={`o-${k}`}>
        <Input id={`o-${k}`} name="todo" defaultValue={note?.todo} placeholder="Ex. continuer le renforcement, revoir la posture assise." maxLength={2000} />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium">Document PDF (facultatif)</p>
        {file || existing ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <FileText className="size-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{file ? file.name : existing!.name}</span>
            <span className="text-muted">{kb(file ? file.size : existing!.size)}</span>
            <button type="button" onClick={() => (file ? setFile(null) : setRemoveFile(true))} className="flex size-7 items-center justify-center rounded text-muted hover:text-danger" aria-label="Retirer le document">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface px-3 py-2 text-sm font-medium text-muted hover:text-text">
            <Paperclip className="size-4" aria-hidden="true" />
            Joindre un PDF (10 Mo max.)
            <input type="file" name="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        )}
        <p className="mt-1 text-xs text-muted">Chiffré sur nos serveurs, visible uniquement par votre équipe.</p>
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>Annuler</Button>
        <Button type="submit" size="sm" loading={pending}>Enregistrer la note</Button>
      </div>
    </form>
  );
}

export function DossierNotes({ customerId, notes, canManage, today, term }: { customerId: string; notes: NoteView[]; canManage: boolean; today: string; term: string }) {
  const [editing, setEditing] = useState<string | null>(null); // id de note, "new" ou null
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [, startDelete] = useTransition();
  const shown = useMemo(() => {
    const q = fold(query.trim());
    return q ? notes.filter((n) => fold(`${n.title} ${n.note} ${n.todo} ${n.dateLabel} ${n.file?.name ?? ""}`).includes(q)) : notes;
  }, [notes, query]);

  return (
    <Card>
      <CardHeader
        title="Dossier de suivi"
        description="Notes chiffrées, visibles uniquement par votre équipe."
        action={canManage && editing !== "new" ? <Button size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing("new")}>Nouvelle note</Button> : null}
      />
      <div className="space-y-4 p-5">
        {notes.length > 3 ? (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une note (titre, texte, date…)" className="pl-9" aria-label="Rechercher une note" />
          </div>
        ) : null}
        {editing === "new" ? <NoteEditor customerId={customerId} note={null} today={today} onDone={() => setEditing(null)} /> : null}
        {notes.length === 0 && editing !== "new" ? (
          <EmptyState icon={<NotebookPen />} title={`Aucune note pour ce ${term}`} description="Ajoutez la première : constat, soin réalisé, document PDF…" />
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted">Aucune note ne correspond.</p>
        ) : (
          <ol className="space-y-4">
            {shown.map((n) =>
              editing === n.id ? (
                <li key={n.id}><NoteEditor customerId={customerId} note={n} today={today} onDone={() => setEditing(null)} /></li>
              ) : (
                <li key={n.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{n.title || n.dateLabel}</p>
                      <p className="text-xs text-muted">{n.title ? `${n.dateLabel} · ` : ""}{n.author ?? "—"}</p>
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => setEditing(n.id)} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label="Modifier la note"><Pencil className="size-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => setConfirmDelete(n.id)} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label="Supprimer la note"><Trash2 className="size-4" aria-hidden="true" /></button>
                      </div>
                    ) : null}
                  </div>
                  {n.note ? <p className="mt-2 text-sm whitespace-pre-line">{n.note}</p> : null}
                  {n.todo ? (
                    <p className="mt-2 flex items-start gap-2 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">
                      <CheckSquare className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span><span className="font-medium">À faire : </span>{n.todo}</span>
                    </p>
                  ) : null}
                  {n.file ? (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border px-3 py-2 text-sm">
                      <span className="flex min-w-0 flex-1 items-center gap-2"><FileText className="size-4 shrink-0 text-muted" aria-hidden="true" /><span className="truncate">{n.file.name}</span></span>
                      <a href={`/app/clients/${customerId}/notes/${n.id}/fichier`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover"><ExternalLink className="size-3.5" aria-hidden="true" />Ouvrir</a>
                      <a href={`/app/clients/${customerId}/notes/${n.id}/fichier?telecharger`} className="inline-flex items-center gap-1 font-medium text-muted hover:text-text"><Download className="size-3.5" aria-hidden="true" />Télécharger</a>
                    </div>
                  ) : null}
                  {confirmDelete === n.id ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3">
                      <p className="mr-auto text-sm text-danger">Supprimer définitivement cette note{n.file ? " et son document" : ""} ?</p>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Non</Button>
                      <Button size="sm" variant="danger" onClick={() => startDelete(async () => { await deleteNote(customerId, n.id); setConfirmDelete(null); })}>Oui, supprimer</Button>
                    </div>
                  ) : null}
                </li>
              ),
            )}
          </ol>
        )}
      </div>
    </Card>
  );
}

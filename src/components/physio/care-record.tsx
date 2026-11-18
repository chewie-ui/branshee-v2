"use client";

import { useState, useTransition } from "react";
import { EyeOff, History, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { deleteCareEntry, saveCareEntry } from "@/server/actions/physio";

export type EntryVersion = { version: number; content: string; deleted: boolean; author: string; at: string; date: string | null; confidential?: boolean; passive?: boolean };
export type EntryView = { key: string; content: string; date: string | null; author: string; at: string; versions: EntryVersion[]; confidential: boolean; passive: boolean };
export type SectionView = { key: string; label: string; hint: string; multi: boolean; entries: EntryView[] };

const day = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

function Editor({ episodeId, section, entry, multi, today, onDone }: { episodeId: string; section: string; entry: EntryView | null; multi: boolean; today: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-surface-muted/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await saveCareEntry(episodeId, entry?.key ?? null, { section, content: String(fd.get("content") ?? ""), date: String(fd.get("date") ?? ""), confidential: fd.get("confidential") === "on", passive: fd.get("passive") === "on" });
          if (r.ok) onDone();
          else setError(r.error);
        });
      }}
    >
      {multi ? (
        <Field label="Date" htmlFor={`d-${section}-${entry?.key ?? "new"}`}>
          <Input id={`d-${section}-${entry?.key ?? "new"}`} name="date" type="date" defaultValue={entry?.date ?? today} className="sm:max-w-[12rem]" />
        </Field>
      ) : null}
      <Textarea name="content" rows={6} maxLength={20000} defaultValue={entry?.content} required aria-label="Contenu" />
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" name="confidential" defaultChecked={entry?.confidential} className="size-4 accent-[var(--color-accent)]" />Confidentielle (visible par moi seul, jamais exportée)</label>
        <label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" name="passive" defaultChecked={entry?.passive} className="size-4 accent-[var(--color-accent)]" />Passive (plus d&apos;actualité, gardée pour les décisions)</label>
      </div>
      {entry ? <p className="text-xs text-muted">La version actuelle reste dans l&apos;historique : rien n&apos;est écrasé.</p> : null}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>Enregistrer</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Annuler</Button>
      </div>
    </form>
  );
}

function Entry({ episodeId, section, e, multi, canManage, today }: { episodeId: string; section: string; e: EntryView; multi: boolean; canManage: boolean; today: string }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  if (editing) return <Editor episodeId={episodeId} section={section} entry={e} multi={multi} today={today} onDone={() => setEditing(false)} />;
  return (
    <div className={`rounded-lg border border-border p-4 ${e.passive ? "bg-surface-muted/60" : ""}`}>
      {(multi && e.date) || e.confidential || e.passive ? (
        <p className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          {multi && e.date ? <span>{day(e.date)}</span> : null}
          {e.confidential ? <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-accent-soft-foreground"><EyeOff className="size-3" aria-hidden="true" />Confidentielle</span> : null}
          {e.passive ? <span className="rounded-md bg-surface px-1.5 py-0.5 ring-1 ring-border">Passive</span> : null}
        </p>
      ) : null}
      <p className={`whitespace-pre-line text-sm ${e.passive ? "text-muted" : ""}`}>{e.content}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{e.author} · {e.at}{e.versions.length > 1 ? ` · version ${e.versions.length}` : ""}</span>
        {e.versions.length > 1 ? (
          <details className="w-full">
            <summary className="inline-flex cursor-pointer items-center gap-1 font-medium text-accent"><History className="size-3.5" aria-hidden="true" />Historique ({e.versions.length} versions)</summary>
            <ol className="mt-2 space-y-2 border-l-2 border-border pl-3">
              {e.versions.map((v) => (
                <li key={v.version}>
                  <p className="font-medium text-text">Version {v.version}{v.deleted ? " (supprimée)" : ""} · {v.author} · {v.at}</p>
                  <p className="whitespace-pre-line text-muted">{v.content}</p>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
        {canManage ? (
          <span className="ml-auto flex gap-1">
            <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-surface-muted" aria-label="Modifier" onClick={() => setEditing(true)}><Pencil className="size-4" aria-hidden="true" /></button>
            <button type="button" disabled={pending} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-danger-soft hover:text-danger" aria-label="Supprimer" onClick={() => start(async () => { await deleteCareEntry(episodeId, e.key); })}><Trash2 className="size-4" aria-hidden="true" /></button>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Dossier kiné structuré d'un épisode : une carte par section, contenu versionné. */
export function CareRecord({ episodeId, sections, canManage, today }: { episodeId: string; sections: SectionView[]; canManage: boolean; today: string }) {
  const [adding, setAdding] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {sections.map((s, i) => {
        const canAdd = canManage && (s.multi || s.entries.length === 0);
        return (
          <Card key={s.key} id={s.key}>
            <CardHeader title={`${i + 1}. ${s.label}`} description={s.hint} action={canAdd && adding !== s.key ? <Button size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setAdding(s.key)}>{s.multi ? "Ajouter" : "Remplir"}</Button> : null} />
            <div className="space-y-3 px-5 pb-5">
              {adding === s.key ? <Editor episodeId={episodeId} section={s.key} entry={null} multi={s.multi} today={today} onDone={() => setAdding(null)} /> : null}
              {s.entries.length === 0 && adding !== s.key ? <p className="text-sm text-muted">Pas encore rempli.</p> : null}
              {[...s.entries].reverse().map((e) => <Entry key={e.key} episodeId={episodeId} section={s.key} e={e} multi={s.multi} canManage={canManage} today={today} />)}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

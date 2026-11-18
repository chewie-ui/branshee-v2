"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Copy, Eye, FileCode2, FileText, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { CARE_DOC_KINDS, documentGaps } from "@/lib/care-team";
import { createCareDocument, deleteCareDocumentDraft, newCareDocumentVersion, saveCareDocument, validateCareDocument } from "@/server/actions/care-documents";
import { saveMyInami } from "@/server/actions/physio";

export type DocVersion = { version: number; status: string; author: string; at: string };
export type DocView = { key: string; kind: string; kindLabel: string; title: string; recipientName: string; recipientInami: string; content: string; status: string; version: number; author: string; at: string; episode: string | null; versions: DocVersion[] };
type EpisodeOpt = { id: string; title: string };

function Editor({ customerId, d, canManage, canExport, onChange }: { customerId: string; d: DocView; canManage: boolean; canExport: boolean; onChange: () => void }) {
  const [content, setContent] = useState(d.content);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const locked = d.status === "validated";
  const gaps = documentGaps(d.kind, content);
  const pdf = `/app/clients/${customerId}/documents/${d.key}`;
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "" } : { ok: false, text: r.error ?? "Erreur." });
      if (r.ok) {
        after?.();
        onChange();
      }
    });
  const save = (form: HTMLFormElement) => () => saveCareDocument(d.key, Object.fromEntries(new FormData(form)));
  return (
    <form
      className="space-y-4 border-t border-border p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(save(e.currentTarget));
      }}
    >
      <fieldset disabled={locked || !canManage} className="space-y-4">
        <Field label="Titre" htmlFor={`dt-${d.key}`}><Input id={`dt-${d.key}`} name="title" defaultValue={d.title} maxLength={160} required /></Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label="Destinataire" htmlFor={`dr-${d.key}`}><Input id={`dr-${d.key}`} name="recipientName" defaultValue={d.recipientName} maxLength={160} /></Field>
          <Field label="INAMI du destinataire" htmlFor={`di-${d.key}`}><Input id={`di-${d.key}`} name="recipientInami" defaultValue={d.recipientInami} maxLength={20} /></Field>
        </div>
        <Textarea name="content" rows={18} maxLength={40000} value={content} onChange={(e) => setContent(e.target.value)} aria-label="Contenu du document" className="font-mono text-[13px]" />
      </fieldset>
      {!locked && gaps.length ? (
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning" role="status">
          <p className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" aria-hidden="true" />À vérifier avant de valider</p>
          <ul className="mt-1 list-disc pl-6">{gaps.map((g) => <li key={g}>{g}</li>)}</ul>
        </div>
      ) : null}
      {locked ? <p className="flex items-center gap-2 text-sm text-muted"><Lock className="size-4" aria-hidden="true" />Validé et verrouillé. Pour le corriger, créez une nouvelle version : celle-ci reste intacte.</p> : null}
      {msg ? <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      <div className="flex flex-wrap gap-2">
        {canManage && !locked ? <Button type="submit" size="sm" variant="secondary" loading={pending}>Enregistrer le brouillon</Button> : null}
        {canExport ? <a href={pdf} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted"><Eye className="size-4" aria-hidden="true" />{locked ? "Ouvrir le PDF" : "Aperçu PDF"}</a> : null}
        {canManage && !locked ? (
          <Button
            type="button"
            size="sm"
            loading={pending}
            icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
            onClick={(e) => {
              const form = e.currentTarget.form!;
              run(async () => {
                const s = await save(form)();
                return s.ok ? validateCareDocument(d.key) : s;
              }, () => canExport && window.open(pdf, "_blank", "noopener"));
            }}
          >
            Valider et imprimer
          </Button>
        ) : null}
        {canExport && locked ? <a href={`${pdf}/kmehr`} download className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted"><FileCode2 className="size-4" aria-hidden="true" />Kmehr (XML)</a> : null}
        {canManage && locked ? <Button type="button" size="sm" variant="secondary" loading={pending} icon={<Copy className="size-4" aria-hidden="true" />} onClick={() => run(() => newCareDocumentVersion(d.key))}>Nouvelle version</Button> : null}
        {canManage && !locked ? <Button type="button" size="sm" variant="ghost" loading={pending} icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => run(() => deleteCareDocumentDraft(d.key))}>Supprimer le brouillon</Button> : null}
      </div>
      {d.versions.length > 1 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-accent">Versions ({d.versions.length})</summary>
          <ul className="mt-2 space-y-1 border-l-2 border-border pl-3 text-muted">
            {d.versions.map((v) => (
              <li key={v.version}>
                {canExport ? <a href={`${pdf}?v=${v.version}`} target="_blank" rel="noopener" className="font-medium text-text hover:underline">Version {v.version}</a> : <span className="font-medium text-text">Version {v.version}</span>} · {v.status === "validated" ? "validée" : "brouillon"} · {v.author} · {v.at}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </form>
  );
}

/** N° INAMI du soignant connecté : repris en en-tête et en signature des documents. */
function MyInami({ initial }: { initial: string }) {
  const [edit, setEdit] = useState(!initial);
  const [value, setValue] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!edit)
    return (
      <p className="px-5 pb-4 text-sm text-muted">
        Votre n° INAMI : <span className="font-medium text-text">{value}</span>{" "}
        <button type="button" className="font-medium text-accent hover:text-accent-hover" onClick={() => setEdit(true)}>Modifier</button>
      </p>
    );
  return (
    <form
      className="flex flex-wrap items-end gap-2 px-5 pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveMyInami(value);
          setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
          if (r.ok && value.trim()) setEdit(false);
        });
      }}
    >
      <Field label="Votre n° INAMI (en-tête des documents)" htmlFor="my-inami" className="min-w-56 flex-1">
        <Input id="my-inami" value={value} onChange={(e) => setValue(e.target.value)} placeholder="5-12345-67-890" inputMode="numeric" maxLength={20} />
      </Field>
      <Button type="submit" size="sm" variant="secondary" loading={pending}>Enregistrer</Button>
      {msg ? <p className={`w-full text-sm ${msg.ok ? "text-success" : "text-danger"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
    </form>
  );
}

/** Documents INAMI du patient : générés depuis un modèle, modifiables, verrouillés une fois validés, versionnés. */
export function CareDocuments({ customerId, docs, episodes, canManage, canExport, defaultEpisode, myInami }: { customerId: string; docs: DocView[]; episodes: EpisodeOpt[]; canManage: boolean; canExport: boolean; defaultEpisode?: string; myInami: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState<string>(CARE_DOC_KINDS[0].key);
  const [episode, setEpisode] = useState(defaultEpisode ?? episodes[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const needsEpisode = CARE_DOC_KINDS.find((k) => k.key === kind)?.episode ?? false;
  return (
    <Card id="documents">
      <CardHeader title="Documents INAMI" description="Rapports, demandes et notifications pré-remplis depuis le dossier. Un document validé est verrouillé ; le modifier crée une nouvelle version." action={canManage && !creating ? <Button size="sm" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setCreating(true)}>Nouveau document</Button> : null} />
      {canManage ? <MyInami initial={myInami} /> : null}
      {creating ? (
        <form
          className="space-y-4 border-b border-border p-5 pt-0"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await createCareDocument(customerId, kind, needsEpisode ? episode || null : null);
              if (r.ok) {
                setCreating(false);
                setOpen(r.key ?? null);
                router.refresh();
              } else setError(r.error);
            });
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Modèle" htmlFor="doc-kind">
              <Select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value)}>{CARE_DOC_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</Select>
            </Field>
            {needsEpisode ? (
              <Field label="Épisode de soins" htmlFor="doc-ep">
                <Select id="doc-ep" value={episode} onChange={(e) => setEpisode(e.target.value)}>
                  <option value="">Sans épisode</option>
                  {episodes.map((ep) => <option key={ep.id} value={ep.id}>{ep.title}</option>)}
                </Select>
              </Field>
            ) : null}
          </div>
          {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={pending}>Créer le brouillon</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>Annuler</Button>
          </div>
        </form>
      ) : null}
      {docs.length === 0 && !creating ? <p className="flex items-center gap-2 px-5 pb-5 text-sm text-muted"><FileText className="size-4" aria-hidden="true" />Aucun document pour l&apos;instant.</p> : null}
      <ul className="divide-y divide-border">
        {docs.map((d) => (
          <li key={d.key}>
            <button type="button" className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-muted" aria-expanded={open === d.key} onClick={() => setOpen(open === d.key ? null : d.key)}>
              <FileText className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-medium">{d.title}</span>
                <span className="block truncate text-muted">{d.kindLabel}{d.recipientName ? ` · à ${d.recipientName}` : ""} · {d.at}</span>
              </span>
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${d.status === "validated" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>{d.status === "validated" ? "Validé" : "Brouillon"}{d.version > 1 ? ` · v${d.version}` : ""}</span>
            </button>
            {open === d.key ? <Editor key={`${d.key}-${d.version}-${d.status}`} customerId={customerId} d={d} canManage={canManage} canExport={canExport} onChange={() => router.refresh()} /> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

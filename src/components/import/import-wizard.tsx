"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { FIELDS, type ImportKind } from "@/lib/import";
import { previewImport, runImport } from "@/server/actions/import";

type Preview = { headers: string[]; sample: string[][]; mapping: Record<string, number>; total: number };
type Done = { created: number; skipped: number; errors: { line: number; reason: string }[] };

const TEMPLATES: Record<ImportKind, string> = {
  clients: "Prénom;Nom;Email;Téléphone;Société;N° de TVA;Adresse;Code postal;Ville\nMarie;Dupont;marie@exemple.be;0470 12 34 56;;;Rue Haute 1;1300;Wavre\n",
  produits: "Nom;Prix TVAC;TVA;Référence;Code-barres;Catégorie;Stock;Seuil d'alerte;Prix d'achat;Fournisseur\nSavon lavande;6,50;21;SAV-01;5412345678901;Savons;24;5;2,10;Savonnerie Bea\n",
};

/** Import en trois temps : choisir le fichier, vérifier les colonnes, importer. */
export function ImportWizard({ kind, title, backHref, doneHref, noun }: { kind: ImportKind; title: string; backHref: string; doneHref: string; noun: { one: string; many: string } }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fields = FIELDS[kind];
  const form = () => { const fd = new FormData(); fd.set("file", file!); return fd; };

  const pick = (f: File | null) => {
    setFile(f); setPreview(null); setDone(null); setError(null);
    if (!f) return;
    start(async () => {
      const fd = new FormData(); fd.set("file", f);
      const r = await previewImport(kind, fd).catch(() => ({ ok: false as const, error: "Envoi impossible. Vérifiez votre connexion." }));
      if (!r.ok) return setError(r.error);
      setPreview(r); setMapping(r.mapping);
    });
  };
  const go = () =>
    start(async () => {
      setError(null);
      const r = await runImport(kind, form(), mapping).catch(() => ({ ok: false as const, error: "Import impossible. Vérifiez votre connexion." }));
      if (!r.ok) return setError(r.error);
      setDone(r);
    });
  const template = `data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + TEMPLATES[kind])}`;

  if (done)
    return (
      <Card className="max-w-2xl space-y-3 p-6">
        <p className="inline-flex items-center gap-2 text-lg font-semibold text-success" role="status"><CheckCircle2 className="size-5" aria-hidden="true" />{done.created} {done.created > 1 ? noun.many : noun.one} importé{done.created > 1 ? "s" : ""}</p>
        {done.skipped ? <p className="text-sm text-muted">{done.skipped} déjà présent{done.skipped > 1 ? "s" : ""} (même {kind === "clients" ? "email" : "code-barres"}) : laissé{done.skipped > 1 ? "s" : ""} tel{done.skipped > 1 ? "s" : ""} quel{done.skipped > 1 ? "s" : ""}.</p> : null}
        {done.errors.length ? (
          <div className="text-sm">
            <p className="font-medium text-warning">{done.errors.length} ligne{done.errors.length > 1 ? "s" : ""} ignorée{done.errors.length > 1 ? "s" : ""} :</p>
            <ul className="mt-1 max-h-48 list-disc overflow-y-auto pl-5 text-muted">{done.errors.map((e) => <li key={e.line}>Ligne {e.line} : {e.reason}</li>)}</ul>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href={doneHref} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 font-medium text-accent-foreground hover:bg-accent-hover">Voir les {noun.many}</Link>
          <Button variant="secondary" onClick={() => { setDone(null); setPreview(null); setFile(null); if (input.current) input.current.value = ""; }}>Importer un autre fichier</Button>
        </div>
      </Card>
    );

  return (
    <div className="space-y-4">
      <Link href={backHref} className="inline-flex text-sm font-medium text-muted hover:text-text">← Retour</Link>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <Card className="max-w-3xl space-y-4 p-5">
        <p className="text-sm text-muted">Exportez la liste depuis votre ancien logiciel (ou Excel) en <b>.csv</b> ou <b>.xlsx</b>, avec une ligne d&apos;en-têtes. Les colonnes sont reconnues automatiquement ; vous vérifiez avant d&apos;importer.</p>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={input} id="imp-file" type="file" accept=".csv,.txt,.xlsx" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          <label htmlFor="imp-file" className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 font-medium text-accent-foreground hover:bg-accent-hover focus-within:outline-2"><FileUp className="size-4" aria-hidden="true" />{file ? "Choisir un autre fichier" : "Choisir le fichier"}</label>
          <a href={template} download={`modele-${kind}.csv`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong px-4 text-sm font-medium hover:bg-surface-muted"><Download className="size-4" aria-hidden="true" />Fichier modèle</a>
          {file ? <span className="min-w-0 truncate text-sm text-muted">{file.name}</span> : null}
        </div>
        {pending && !preview ? <p className="text-sm text-muted" role="status">Lecture du fichier…</p> : null}
        {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
      </Card>

      {preview ? (
        <>
          <Card className="max-w-3xl">
            <CardHeader title={`${preview.total} ligne${preview.total > 1 ? "s" : ""} trouvée${preview.total > 1 ? "s" : ""}`} description="Vérifiez quelle colonne de votre fichier va dans chaque champ." />
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className="grid gap-1 text-sm">
                  <label htmlFor={`imp-${f.key}`} className="font-medium">{f.label}</label>
                  <Select id={`imp-${f.key}`} value={mapping[f.key] ?? -1} onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}>
                    <option value={-1}>Ne pas importer</option>
                    {preview.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </Select>
                </div>
              ))}
            </div>
          </Card>
          <Card className="max-w-3xl overflow-hidden">
            <CardHeader title="Aperçu" description="Les premières lignes, telles qu'elles seront importées." />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-muted text-xs text-muted"><tr>{fields.filter((f) => (mapping[f.key] ?? -1) >= 0).map((f) => <th key={f.key} className="px-3 py-2 font-medium whitespace-nowrap">{f.label}</th>)}</tr></thead>
                <tbody className="divide-y divide-border">{preview.sample.map((r, k) => <tr key={k}>{fields.filter((f) => (mapping[f.key] ?? -1) >= 0).map((f) => <td key={f.key} className="max-w-48 truncate px-3 py-2">{r[mapping[f.key]!] ?? ""}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </Card>
          <div className={cn("flex max-w-3xl flex-wrap items-center gap-3")}>
            <Button icon={<Upload className="size-4" aria-hidden="true" />} loading={pending} onClick={go}>Importer {preview.total} {preview.total > 1 ? noun.many : noun.one}</Button>
            <p className="text-sm text-muted">{kind === "clients" ? "Un client déjà présent avec le même email n'est pas modifié." : "Un produit au code-barres déjà présent n'est pas modifié."}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Copy, ExternalLink, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { deleteArticle, duplicateArticle, saveArticle, uploadArticleImage } from "@/server/actions/admin-blog";

export type ArticleInput = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string;
  contentHtml: string;
  category: string;
  tags: string;
  status: "draft" | "scheduled" | "published";
  scheduledFor: string;
  metaTitle: string;
  metaDescription: string;
  authorName: string;
};

const textarea = "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30";

async function upload(file: File) {
  const fd = new FormData();
  fd.set("file", file);
  const r = await uploadArticleImage(fd);
  if (!r.ok) window.alert(r.error);
  return r.url ?? null;
}

/** Éditeur d'article du blog (contenu, couverture, publication, référencement). */
export function ArticleEditor({ initial }: { initial: ArticleInput }) {
  const router = useRouter();
  const [a, setA] = useState(initial);
  const html = useRef(initial.contentHtml);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Partial<ArticleInput>) => setA((cur) => ({ ...cur, ...patch }));

  const save = (statusOverride?: ArticleInput["status"]) =>
    start(async () => {
      const next = { ...a, status: statusOverride ?? a.status, contentHtml: html.current };
      const r = await saveArticle(a.id, next);
      setStatus({ ok: r.ok, text: r.ok ? (r.message ?? "Enregistré.") : (r.error ?? "Erreur.") });
      if (r.ok) {
        set({ status: next.status });
        if (!a.id && r.id) router.replace(`/admin/blog/${r.id}`);
        else router.refresh();
      }
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <Field label="Titre" htmlFor="a-title">
          <Input id="a-title" value={a.title} onChange={(e) => set({ title: e.target.value })} maxLength={160} className="h-12 text-lg font-semibold" />
        </Field>
        <Field label="Chapeau" htmlFor="a-excerpt" hint="Résumé affiché dans la liste des articles.">
          <textarea id="a-excerpt" value={a.excerpt} onChange={(e) => set({ excerpt: e.target.value })} rows={2} maxLength={400} className={textarea} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium">Contenu</p>
          <RichTextEditor initialHtml={initial.contentHtml} onChange={(v) => (html.current = v)} label="Contenu de l'article" minHeight="min-h-[420px]" headings uploadImage={upload} />
        </div>
      </div>

      <aside className="space-y-4">
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <Field label="Statut" htmlFor="a-status">
            <Select id="a-status" value={a.status} onChange={(e) => set({ status: e.target.value as ArticleInput["status"] })}>
              <option value="draft">Brouillon</option>
              <option value="scheduled">Programmé</option>
              <option value="published">Publié</option>
            </Select>
          </Field>
          {a.status === "scheduled" ? (
            <Field label="Publication le" htmlFor="a-when">
              <Input id="a-when" type="datetime-local" value={a.scheduledFor} onChange={(e) => set({ scheduledFor: e.target.value })} />
            </Field>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button loading={pending} onClick={() => save()}>Enregistrer</Button>
            {a.status === "draft" ? <Button variant="secondary" disabled={pending} onClick={() => save("published")}>Publier</Button> : null}
          </div>
          {status ? <p className={status.ok ? "text-sm text-success" : "text-sm text-danger"} role="status">{status.text}</p> : null}
          {a.id && initial.status === "published" ? (
            <a href={`/blog/${initial.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover">Voir l&apos;article <ExternalLink className="size-3.5" aria-hidden="true" /></a>
          ) : null}
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">Couverture</p>
          {a.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.coverImageUrl} alt="" className="aspect-[16/9] w-full rounded-lg object-cover" />
          ) : null}
          <div className="flex gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted">
              <ImagePlus className="size-4" aria-hidden="true" />
              {a.coverImageUrl ? "Changer" : "Ajouter"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const url = await upload(f); if (url) set({ coverImageUrl: url }); } }} />
            </label>
            {a.coverImageUrl ? <Button size="sm" variant="ghost" onClick={() => set({ coverImageUrl: "" })}>Retirer</Button> : null}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <Field label="Adresse" htmlFor="a-slug" hint="Vide = générée depuis le titre."><Input id="a-slug" value={a.slug} onChange={(e) => set({ slug: e.target.value })} maxLength={120} /></Field>
          <Field label="Catégorie" htmlFor="a-cat"><Input id="a-cat" value={a.category} onChange={(e) => set({ category: e.target.value })} maxLength={60} /></Field>
          <Field label="Mots-clés" htmlFor="a-tags" hint="Séparés par des virgules."><Input id="a-tags" value={a.tags} onChange={(e) => set({ tags: e.target.value })} maxLength={400} /></Field>
          <Field label="Auteur" htmlFor="a-author"><Input id="a-author" value={a.authorName} onChange={(e) => set({ authorName: e.target.value })} maxLength={80} /></Field>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">Référencement (Google)</p>
          <Field label={`Titre (${a.metaTitle.length}/70)`} htmlFor="a-mt"><Input id="a-mt" value={a.metaTitle} onChange={(e) => set({ metaTitle: e.target.value })} maxLength={70} placeholder={a.title} /></Field>
          <Field label={`Description (${a.metaDescription.length}/170)`} htmlFor="a-md"><textarea id="a-md" value={a.metaDescription} onChange={(e) => set({ metaDescription: e.target.value })} rows={3} maxLength={170} className={textarea} placeholder={a.excerpt} /></Field>
        </div>

        {a.id ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Copy className="size-4" aria-hidden="true" />} disabled={pending} onClick={() => start(async () => void (await duplicateArticle(a.id!)))}>Dupliquer</Button>
            {confirm ? (
              <Button size="sm" variant="danger" loading={pending} onClick={() => start(async () => void (await deleteArticle(a.id!)))}>Confirmer la suppression</Button>
            ) : (
              <Button size="sm" variant="ghost" className="text-danger hover:text-danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>Supprimer</Button>
            )}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

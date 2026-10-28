"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, File, FileImage, FileText, Folder, FolderPlus, Link2, MoreHorizontal, Pencil, Search, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { createFolder, deleteDocument, deleteFolder, moveDocument, renameDocument, renameFolder, shareDocument, unshareDocument, uploadDocument } from "@/server/actions/documents";

type FileRow = { id: string; name: string; mime: string; size: number; createdAt: string; by: string | null; uploadedById: string | null; shareToken: string | null; shareExpiresAt: string | null; customer: string | null; customerId: string | null; folder?: string | null };
type FolderRow = { id: string; name: string; customer: string | null; count: number };
type Res = { ok: boolean; message?: string; error?: string; url?: string };
const MAX = 10 * 1024 * 1024;

export const fmtSize = (b: number) => (b < 1024 ? `${b} o` : b < 1024 ** 2 ? `${Math.round(b / 1024)} Ko` : b < 1024 ** 3 ? `${(b / 1024 ** 2).toFixed(1).replace(".", ",")} Mo` : `${(b / 1024 ** 3).toFixed(2).replace(".", ",")} Go`);
const icon = (mime: string) => (mime.startsWith("image/") ? FileImage : mime === "application/pdf" || mime === "text/plain" ? FileText : File);

/** Explorateur : fil d'Ariane, dossiers, fichiers, envoi (glisser-déposer), recherche, partage par lien. */
export function DocExplorer({ folderId, path, q, subfolders, files, allFolders, clients, me, canManage, usedBytes, quotaBytes }: { folderId: string | null; path: { id: string; name: string }[]; q: string; subfolders: FolderRow[]; files: FileRow[]; allFolders: { id: string; name: string; parentId: string | null }[]; clients: { id: string; name: string }[]; me: string; canManage: boolean; usedBytes: number; quotaBytes: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [menu, setMenu] = useState<FileRow | null>(null);
  const [delFolder, setDelFolder] = useState<FolderRow | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string; kind: "file" | "folder" } | null>(null);
  const [search, setSearch] = useState(q);
  const [pending, start] = useTransition();
  const here = folderId ? `/app/documents?dossier=${folderId}` : "/app/documents";

  const run = (fn: () => Promise<Res>, after?: (r: Res) => void) =>
    start(async () => {
      const r: Res = await fn().catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion." }));
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Fait.") : (r.error ?? "Action impossible.") });
      if (r.ok) after?.(r);
      router.refresh();
    });

  const upload = async (list: FileList | File[]) => {
    const arr = [...list];
    if (!arr.length) return;
    setMsg(null);
    let ok = 0;
    const errors: string[] = [];
    for (const [i, f] of arr.entries()) {
      if (f.size > MAX) { errors.push(`« ${f.name} » dépasse 10 Mo`); continue; }
      setProgress(`Envoi ${i + 1}/${arr.length} : ${f.name}`);
      const fd = new FormData();
      fd.set("file", f);
      fd.set("folderId", folderId ?? "");
      const r: Res = await uploadDocument(fd).catch(() => ({ ok: false, error: `« ${f.name} » : envoi impossible` }));
      if (r.ok) ok++; else errors.push(r.error ?? f.name);
    }
    setProgress(null);
    setMsg(errors.length ? { ok: false, text: `${ok} fichier${ok > 1 ? "s" : ""} ajouté${ok > 1 ? "s" : ""}. ${errors.join(" · ")}.` } : { ok: true, text: `${ok} fichier${ok > 1 ? "s" : ""} ajouté${ok > 1 ? "s" : ""}.` });
    if (input.current) input.current.value = "";
    router.refresh();
  };

  const pct = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));
  return (
    <div
      className={cn("space-y-4 rounded-xl transition-colors", over && "bg-accent-soft/40 outline-2 outline-dashed outline-accent")}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false); }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); } }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <form className="relative w-full sm:w-72" onSubmit={(e) => { e.preventDefault(); router.push(search.trim() ? `/app/documents?q=${encodeURIComponent(search.trim())}` : "/app/documents"); }}>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <label htmlFor="doc-q" className="sr-only">Rechercher un fichier</label>
          <Input id="doc-q" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un fichier" className="pl-9" />
        </form>
        <div className="ml-auto flex flex-wrap gap-2">
          {!q ? <Button variant="secondary" icon={<FolderPlus className="size-4" aria-hidden="true" />} onClick={() => setNewFolder("")}>Nouveau dossier</Button> : null}
          {!q ? <Button icon={<Upload className="size-4" aria-hidden="true" />} loading={!!progress} onClick={() => input.current?.click()}>Ajouter des fichiers</Button> : null}
          <input ref={input} type="file" multiple className="sr-only" aria-label="Fichiers à ajouter" onChange={(e) => e.target.files && upload(e.target.files)} />
        </div>
      </div>

      <nav aria-label="Dossier" className="flex flex-wrap items-center gap-1 text-sm">
        <Link href="/app/documents" className={cn("rounded px-1.5 py-1 hover:bg-surface-muted", !path.length && !q && "font-semibold")}>Documents</Link>
        {q ? <><ChevronRight className="size-4 text-muted" aria-hidden="true" /><span className="px-1.5 font-semibold">Recherche « {q} »</span></> : null}
        {path.map((p, i) => (
          <span key={p.id} className="inline-flex items-center gap-1"><ChevronRight className="size-4 text-muted" aria-hidden="true" /><Link href={`/app/documents?dossier=${p.id}`} aria-current={i === path.length - 1 ? "page" : undefined} className={cn("rounded px-1.5 py-1 hover:bg-surface-muted", i === path.length - 1 && "font-semibold")}>{p.name}</Link></span>
        ))}
      </nav>
      {progress ? <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent" role="status">{progress}</p> : null}
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}

      {newFolder !== null ? (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(() => createFolder({ name: newFolder, parentId: folderId }), () => setNewFolder(null)); }}>
          <label htmlFor="nf-name" className="sr-only">Nom du dossier</label>
          <Input id="nf-name" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Nom du dossier" maxLength={80} autoFocus className="max-w-xs" />
          <Button type="submit" loading={pending} disabled={!newFolder.trim()}>Créer</Button>
          <Button type="button" variant="ghost" onClick={() => setNewFolder(null)}>Annuler</Button>
        </form>
      ) : null}

      {subfolders.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {subfolders.map((f) => (
            <li key={f.id} className="group relative">
              {renaming?.id === f.id ? (
                <form className="flex gap-1 rounded-xl border border-border bg-surface p-2" onSubmit={(e) => { e.preventDefault(); run(() => renameFolder(f.id, renaming.name), () => setRenaming(null)); }}>
                  <label htmlFor={`rf-${f.id}`} className="sr-only">Nom du dossier</label>
                  <Input id={`rf-${f.id}`} value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} maxLength={80} autoFocus className="h-9" />
                  <Button size="sm" type="submit" className="h-9">OK</Button>
                </form>
              ) : (
                <>
                  <Link href={`/app/documents?dossier=${f.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 pr-20 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    <Folder className="size-6 shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0"><span className="block truncate font-medium">{f.name}</span><span className="block truncate text-xs text-muted">{f.count} fichier{f.count > 1 ? "s" : ""}{f.customer ? ` · ${f.customer}` : ""}</span></span>
                  </Link>
                  <div className="absolute top-1/2 right-2 flex -translate-y-1/2 gap-0.5">
                    <button type="button" onClick={() => setRenaming({ id: f.id, name: f.name, kind: "folder" })} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label={`Renommer ${f.name}`}><Pencil className="size-4" aria-hidden="true" /></button>
                    {canManage ? <button type="button" onClick={() => setDelFolder(f)} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label={`Supprimer ${f.name}`}><Trash2 className="size-4" aria-hidden="true" /></button> : null}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {files.length ? (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {files.map((f) => {
              const Icon = icon(f.mime);
              const shared = f.shareToken && f.shareExpiresAt && new Date(f.shareExpiresAt) > new Date();
              return (
                <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <Icon className="size-5 shrink-0 text-muted" aria-hidden="true" />
                  {renaming?.id === f.id ? (
                    <form className="flex min-w-0 flex-1 gap-1" onSubmit={(e) => { e.preventDefault(); run(() => renameDocument(f.id, renaming.name), () => setRenaming(null)); }}>
                      <label htmlFor={`rn-${f.id}`} className="sr-only">Nom du fichier</label>
                      <Input id={`rn-${f.id}`} value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} maxLength={200} autoFocus className="h-9" />
                      <Button size="sm" type="submit" className="h-9">OK</Button>
                    </form>
                  ) : (
                    <a href={`/app/documents/${f.id}/fichier`} target="_blank" rel="noopener" className="min-w-0 flex-1 hover:text-accent">
                      <span className="block truncate text-sm font-medium">{f.name}</span>
                      <span className="block truncate text-xs text-muted">{[fmtSize(f.size), new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(f.createdAt)), f.by, f.folder, f.customer].filter(Boolean).join(" · ")}</span>
                    </a>
                  )}
                  {shared ? <span className="hidden shrink-0 items-center gap-1 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent sm:inline-flex"><Link2 className="size-3" aria-hidden="true" />Partagé</span> : null}
                  <a href={`/app/documents/${f.id}/fichier?telecharger`} download className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label={`Télécharger ${f.name}`}><Download className="size-4" aria-hidden="true" /></a>
                  <button type="button" onClick={() => { setMsg(null); setMenu(f); }} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label={`Actions pour ${f.name}`}><MoreHorizontal className="size-4" aria-hidden="true" /></button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : !subfolders.length ? (
        <Card className="p-8 text-center">
          <Upload className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-medium">{q ? "Aucun fichier trouvé" : "Ce dossier est vide"}</p>
          {!q ? <p className="mx-auto mt-1 max-w-md text-sm text-muted">Glissez vos fichiers ici, ou cliquez sur « Ajouter des fichiers ». 10 Mo maximum par fichier.</p> : null}
        </Card>
      ) : null}

      <div className="max-w-xs">
        <div className="flex justify-between text-xs text-muted"><span>Espace utilisé</span><span>{fmtSize(usedBytes)} sur {fmtSize(quotaBytes)}</span></div>
        <div className="mt-1 h-1.5 rounded-full bg-surface-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Espace utilisé"><div className={cn("h-full rounded-full", pct > 90 ? "bg-danger" : "bg-accent")} style={{ width: `${Math.max(1, pct)}%` }} /></div>
      </div>

      {menu ? <FileMenu f={menu} me={me} canManage={canManage} folders={allFolders} clients={clients} pending={pending} onClose={() => setMenu(null)} onRename={() => { setRenaming({ id: menu.id, name: menu.name, kind: "file" }); setMenu(null); }} run={run} back={here} /> : null}
      <ConfirmDialog open={!!delFolder} title={`Supprimer le dossier « ${delFolder?.name ?? ""} » ?`} confirmLabel="Supprimer" danger loading={pending} onCancel={() => setDelFolder(null)} onConfirm={() => delFolder && run(() => deleteFolder(delFolder.id), () => setDelFolder(null))}>
        Le dossier, ses sous-dossiers et tous leurs fichiers sont supprimés définitivement.
      </ConfirmDialog>
    </div>
  );
}

function FileMenu({ f, me, canManage, folders, pending, onClose, onRename, run }: { f: FileRow; me: string; canManage: boolean; folders: { id: string; name: string; parentId: string | null }[]; clients: { id: string; name: string }[]; pending: boolean; onClose: () => void; onRename: () => void; run: (fn: () => Promise<Res>, after?: (r: Res) => void) => void; back: string }) {
  const [days, setDays] = useState(7);
  const [link, setLink] = useState<string | null>(f.shareToken && f.shareExpiresAt && new Date(f.shareExpiresAt) > new Date() ? `${window.location.origin}/partage/${f.shareToken}` : null);
  const [target, setTarget] = useState("");
  const [confirm, setConfirm] = useState(false);
  const mine = canManage || f.uploadedById === me;
  const label = (id: string) => { const names: string[] = []; let cur = folders.find((x) => x.id === id); for (let i = 0; cur && i < 10; i++) { names.unshift(cur.name); cur = folders.find((x) => x.id === cur!.parentId); } return names.join(" / "); };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="fm-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2"><h2 id="fm-title" className="min-w-0 truncate text-lg font-semibold">{f.name}</h2><button type="button" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label="Fermer"><X className="size-5" aria-hidden="true" /></button></div>
        <div className="mt-4 space-y-5">
          {mine ? (
            <section>
              <h3 className="text-sm font-medium">Partager par lien</h3>
              <p className="text-xs text-muted">Toute personne qui a le lien peut télécharger le fichier, sans compte.</p>
              {link ? (
                <div className="mt-2 space-y-2">
                  <Input readOnly value={link} aria-label="Lien de partage" onFocus={(e) => e.target.select()} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(link)}>Copier</Button>
                    <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(() => unshareDocument(f.id), () => setLink(null))}>Désactiver le lien</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <label htmlFor="fm-days" className="sr-only">Durée</label>
                  <Select id="fm-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-9"><option value={1}>24 heures</option><option value={7}>7 jours</option><option value={30}>30 jours</option></Select>
                  <Button size="sm" className="h-9" loading={pending} icon={<Link2 className="size-4" aria-hidden="true" />} onClick={() => run(() => shareDocument(f.id, days), (r) => r.url && setLink(r.url))}>Créer le lien</Button>
                </div>
              )}
            </section>
          ) : null}
          <section>
            <Field label="Déplacer vers" htmlFor="fm-move">
              <div className="flex gap-2">
                <Select id="fm-move" value={target} onChange={(e) => setTarget(e.target.value)} className="h-9">
                  <option value="">Choisir…</option>
                  <option value="root">Documents (racine)</option>
                  {folders.map((x) => <option key={x.id} value={x.id}>{label(x.id)}</option>)}
                </Select>
                <Button size="sm" className="h-9" disabled={!target || pending} onClick={() => run(() => moveDocument(f.id, target === "root" ? null : target), onClose)}>Déplacer</Button>
              </div>
            </Field>
          </section>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button size="sm" variant="secondary" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={onRename}>Renommer</Button>
            {mine ? <Button size="sm" variant="ghost" className="text-danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>Supprimer</Button> : null}
          </div>
        </div>
      </div>
      <ConfirmDialog open={confirm} title="Supprimer ce fichier ?" confirmLabel="Supprimer" danger loading={pending} onCancel={() => setConfirm(false)} onConfirm={() => run(() => deleteDocument(f.id), onClose)}>
        Il est effacé définitivement, ainsi que son lien de partage.
      </ConfirmDialog>
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FileText, NotebookPen, Paperclip, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useT } from "@/components/app-locale";
import { deleteShare, shareFile, shareNote } from "@/server/actions/client-shares";

export type ShareView = { id: string; kind: "note" | "file"; title: string; body: string | null; fileName: string | null; size: number | null; author: string; when: string; seen: boolean };

const kb = (n: number | null) => (n ? (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`) : "");

/**
 * Fiche client : ce que le pro partage avec son client (note ou fichier), visible dans l'espace client.
 * `hasAccount` : le client a déjà un compte (sinon il le verra dès qu'il en crée un avec son email).
 */
export function SharesPanel({ customerId, items, canManage, hasAccount, email }: { customerId: string; items: ShareView[]; canManage: boolean; hasAccount: boolean; email: string | null }) {
  const t = useT();
  const [mode, setMode] = useState<"note" | "file">("note");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t("Partager avec le client")} description={hasAccount ? t("Ce que vous partagez ici apparaît dans son espace client : exercices, consignes, document à ramener…") : email ? t("Pas encore de compte client : il verra ces partages dès qu'il créera son compte avec") + ` ${email}.` : t("Ajoutez son email sur la fiche pour qu'il puisse voir ces partages dans son espace client.")} />
        {canManage ? (
          <form
            ref={formRef}
            className="space-y-3 p-5 pt-0"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setMsg(null);
              start(async () => {
                const r = mode === "note" ? await shareNote(customerId, { title: String(fd.get("title") ?? ""), body: String(fd.get("body") ?? ""), notify: fd.get("notify") === "on" }) : await shareFile(customerId, fd);
                setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
                if (r.ok) formRef.current?.reset();
              });
            }}
          >
            <div className="inline-flex rounded-lg bg-surface-muted p-1" role="tablist" aria-label={t("Type de partage")}>
              {(["note", "file"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium ${mode === k ? "bg-surface shadow-sm" : "text-muted hover:text-text"}`}>
                  {k === "note" ? <NotebookPen className="size-4" aria-hidden="true" /> : <Paperclip className="size-4" aria-hidden="true" />}
                  {k === "note" ? t("Note") : t("Fichier")}
                </button>
              ))}
            </div>
            <Field label={t("Titre (facultatif)")} htmlFor="share-title">
              <Input id="share-title" name="title" maxLength={120} placeholder={mode === "note" ? t("Ex. À ramener la prochaine fois") : t("Ex. Exercices pour le genou")} />
            </Field>
            {mode === "note" ? (
              <Field label={t("Note pour le client")} htmlFor="share-body">
                <Textarea id="share-body" name="body" rows={4} maxLength={5000} required placeholder={t("Ex. Pensez à ramener votre prescription et une serviette. Exercices : 3 séries de 10, matin et soir.")} />
              </Field>
            ) : (
              <Field label={t("Fichier (PDF, image, vidéo… 10 Mo max.)")} htmlFor="share-file">
                <Input id="share-file" name="file" type="file" required className="h-auto py-2" />
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="notify" defaultChecked={!!email} disabled={!email} className="size-4 accent-[var(--accent)]" />
              {t("Prévenir le client par email (sans le contenu)")}
            </label>
            {msg ? <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
            <Button type="submit" loading={pending} icon={<Send className="size-4" aria-hidden="true" />}>{t("Partager")}</Button>
          </form>
        ) : null}
      </Card>

      <Card>
        <CardHeader title={t("Déjà partagé")} />
        {items.length === 0 ? (
          <EmptyState icon={<FileText className="size-6" aria-hidden="true" />} title={t("Rien de partagé pour l'instant")} description={t("Les notes et fichiers partagés apparaîtront ici et dans son espace client.")} />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((s) => (
              <li key={s.id} className="flex items-start gap-3 px-5 py-3">
                {s.kind === "note" ? <NotebookPen className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" /> : <Paperclip className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{s.title || (s.kind === "note" ? t("Note") : s.fileName)}</p>
                  {s.kind === "note" ? <p className="mt-0.5 whitespace-pre-line text-muted">{s.body}</p> : <p className="mt-0.5 text-muted">{s.fileName} · {kb(s.size)}</p>}
                  <p className="mt-1 text-xs text-muted">{s.when} · {s.author}{s.seen ? ` · ${t("vu par le client")}` : ""}</p>
                </div>
                {s.kind === "file" ? (
                  <a href={`/app/clients/${customerId}/partages/${s.id}`} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-surface-muted" aria-label={`${t("Télécharger")} ${s.fileName ?? ""}`}><Download className="size-4" aria-hidden="true" /></a>
                ) : null}
                {canManage ? (
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                    aria-label={t("Retirer de son espace")}
                    onClick={() => start(async () => { const r = await deleteShare(s.id); setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error }); })}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

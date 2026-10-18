"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { closeSupport, decideReviewReport, deleteAdminMessage, deleteHelpSection, deleteSupportThread, moveHelpSection, replySupport, saveHelpSection, sendAdminMessage } from "@/server/actions/admin-relations";

const textarea = "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30";

/** Rafraîchit la page serveur à intervalle régulier (nouveaux messages). */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === "visible" && router.refresh(), seconds * 1000);
    return () => window.clearInterval(t);
  }, [router, seconds]);
  return null;
}

export function SupportReply({ userId, closed }: { userId: string; closed: boolean }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="border-t border-border p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await replySupport(userId, text);
            if (r.ok) setText("");
            setError(r.ok ? null : (r.error ?? "Erreur."));
          });
        }}
      >
        <label htmlFor="reply" className="sr-only">Réponse</label>
        <textarea id="reply" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} placeholder="Votre réponse (le pro est prévenu par email)…" className={textarea} />
        {error ? <p className="mt-1 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" loading={pending} disabled={!text.trim()} icon={<Send className="size-4" aria-hidden="true" />}>Répondre</Button>
          {!closed ? <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => void (await closeSupport(userId)))}>Clôturer (demander une note)</Button> : null}
          {confirm ? (
            <span className="ml-auto flex items-center gap-2 text-sm">
              Supprimer la conversation ?
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(false)}>Non</Button>
              <Button type="button" size="sm" variant="danger" loading={pending} onClick={() => start(async () => void (await deleteSupportThread(userId)))}>Oui</Button>
            </span>
          ) : (
            <Button type="button" size="sm" variant="ghost" className="ml-auto text-danger hover:text-danger" onClick={() => setConfirm(true)} icon={<Trash2 className="size-4" aria-hidden="true" />}>Supprimer</Button>
          )}
        </div>
      </form>
    </div>
  );
}

export function AdminMessageForm() {
  const [audience, setAudience] = useState<"all" | "some">("all");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [key, setKey] = useState(0);
  return (
    <form
      key={key}
      className="space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const v = (k: string) => String(fd.get(k) ?? "");
        start(async () => {
          const r = await sendAdminMessage({ audience, emails: v("emails"), type: v("type") as "info", title: v("title"), body: v("body"), ctaLabel: v("ctaLabel"), ctaUrl: v("ctaUrl") });
          setStatus({ ok: r.ok, text: r.ok ? (r.message ?? "Envoyé.") : (r.error ?? "Erreur.") });
          if (r.ok) setKey((k) => k + 1);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Destinataires" htmlFor="m-aud">
          <Select id="m-aud" value={audience} onChange={(e) => setAudience(e.target.value as "all")}>
            <option value="all">Tous les pros</option>
            <option value="some">Certains comptes (emails)</option>
          </Select>
        </Field>
        <Field label="Type" htmlFor="m-type">
          <Select id="m-type" name="type" defaultValue="info">
            <option value="info">Information</option>
            <option value="tip">Astuce</option>
            <option value="success">Bonne nouvelle</option>
            <option value="warning">Attention</option>
            <option value="security">Sécurité</option>
          </Select>
        </Field>
      </div>
      {audience === "some" ? (
        <Field label="Emails" htmlFor="m-emails" hint="Séparés par des virgules ou des retours à la ligne.">
          <textarea id="m-emails" name="emails" rows={2} className={textarea} />
        </Field>
      ) : null}
      <Field label="Titre" htmlFor="m-title"><Input id="m-title" name="title" maxLength={140} required /></Field>
      <Field label="Message" htmlFor="m-body"><textarea id="m-body" name="body" rows={4} maxLength={4000} className={textarea} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bouton (facultatif)" htmlFor="m-cta"><Input id="m-cta" name="ctaLabel" maxLength={60} placeholder="Découvrir" /></Field>
        <Field label="Lien du bouton" htmlFor="m-url"><Input id="m-url" name="ctaUrl" maxLength={500} placeholder="/app/reglages/sms ou https://…" /></Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} icon={<Send className="size-4" aria-hidden="true" />}>Publier</Button>
        {status ? <p className={status.ok ? "text-sm text-success" : "text-sm text-danger"} role="status">{status.text}</p> : null}
      </div>
    </form>
  );
}

export function DeleteMessageButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => void (await deleteAdminMessage(id)))} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label="Supprimer ce message">
      <Trash2 className="size-4" aria-hidden="true" />
    </button>
  );
}

type Video = { id: string; title: string; url: string; duration: string };
type Faq = { id: string; question: string; answer: string; k: string };
export type HelpSectionInput = { id: string | null; title: string; videos: Video[]; faqs: { id: string; question: string; answer: string }[] };

/** Éditeur d'une section du centre d'aide (titre, vidéos, questions fréquentes). */
export function HelpSectionEditor({ initial, first, last, onCreated }: { initial: HelpSectionInput; first: boolean; last: boolean; onCreated?: () => void }) {
  const [title, setTitle] = useState(initial.title);
  const [videos, setVideos] = useState<Video[]>(initial.videos);
  const [faqs, setFaqs] = useState<Faq[]>(() => initial.faqs.map((f, i) => ({ ...f, k: f.id || `i${i}` })));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const setVideo = (i: number, v: Partial<Video>) => setVideos((l) => l.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const setFaq = (i: number, v: Partial<Faq>) => setFaqs((l) => l.map((x, j) => (j === i ? { ...x, ...v } : x)));

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-end gap-2">
        <Field label="Titre de la section" htmlFor={`t-${initial.id ?? "new"}`} className="flex-1">
          <Input id={`t-${initial.id ?? "new"}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ex. Premiers pas" />
        </Field>
        {initial.id ? (
          <>
            <Button type="button" variant="ghost" size="sm" disabled={first || pending} onClick={() => start(async () => void (await moveHelpSection(initial.id!, "up")))} aria-label="Monter la section"><ArrowUp className="size-4" aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="sm" disabled={last || pending} onClick={() => start(async () => void (await moveHelpSection(initial.id!, "down")))} aria-label="Descendre la section"><ArrowDown className="size-4" aria-hidden="true" /></Button>
          </>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Vidéos</p>
        {videos.map((v, i) => (
          <div key={v.id || i} className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]">
            <Input value={v.title} onChange={(e) => setVideo(i, { title: e.target.value })} placeholder="Titre" aria-label={`Titre de la vidéo ${i + 1}`} maxLength={160} />
            <Input value={v.url} onChange={(e) => setVideo(i, { url: e.target.value })} placeholder="https://youtu.be/… (vide = bientôt)" aria-label={`Lien de la vidéo ${i + 1}`} maxLength={500} />
            <Input value={v.duration} onChange={(e) => setVideo(i, { duration: e.target.value })} placeholder="3 min" aria-label={`Durée de la vidéo ${i + 1}`} maxLength={20} />
            <Button type="button" variant="ghost" size="sm" onClick={() => setVideos((l) => l.filter((_, j) => j !== i))} aria-label={`Retirer la vidéo ${i + 1}`}><Trash2 className="size-4" aria-hidden="true" /></Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setVideos((l) => [...l, { id: "", title: "", url: "", duration: "" }])}>Ajouter une vidéo</Button>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Questions fréquentes</p>
        {faqs.map((f, i) => (
          <div key={f.k} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex gap-2">
              <Input value={f.question} onChange={(e) => setFaq(i, { question: e.target.value })} placeholder="Question" aria-label={`Question ${i + 1}`} maxLength={300} />
              <Button type="button" variant="ghost" size="sm" onClick={() => setFaqs((l) => l.filter((_, j) => j !== i))} aria-label={`Retirer la question ${i + 1}`}><Trash2 className="size-4" aria-hidden="true" /></Button>
            </div>
            <RichTextEditor initialHtml={f.answer} onChange={(html) => setFaq(i, { answer: html })} label={`Réponse ${i + 1}`} minHeight="min-h-20" />
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setFaqs((l) => [...l, { id: "", question: "", answer: "", k: `n${new Date().getTime()}` }])}>Ajouter une question</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button
          type="button"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await saveHelpSection({ id: initial.id, title, videos, faqs: faqs.map(({ id, question, answer }) => ({ id, question, answer })) });
              setStatus({ ok: r.ok, text: r.ok ? (r.message ?? "Enregistré.") : (r.error ?? "Erreur.") });
              if (r.ok && !initial.id) onCreated?.();
            })
          }
        >
          {initial.id ? "Enregistrer la section" : "Créer la section"}
        </Button>
        {status ? <p className={status.ok ? "text-sm text-success" : "text-sm text-danger"} role="status">{status.text}</p> : null}
        {initial.id ? (
          confirm ? (
            <span className="ml-auto flex items-center gap-2 text-sm">
              Supprimer la section ?
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(false)}>Non</Button>
              <Button type="button" size="sm" variant="danger" loading={pending} onClick={() => start(async () => void (await deleteHelpSection(initial.id!)))}>Oui</Button>
            </span>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="ml-auto text-danger hover:text-danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>Supprimer</Button>
          )
        ) : null}
      </div>
    </div>
  );
}

export function NewHelpSection() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  if (!open) return <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setOpen(true)}>Nouvelle section</Button>;
  return <HelpSectionEditor key={key} initial={{ id: null, title: "", videos: [], faqs: [] }} first last onCreated={() => { setOpen(false); setKey((k) => k + 1); }} />;
}

export function ReportDecision({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const decide = (d: "accepted" | "rejected") => start(async () => { const r = await decideReviewReport(id, d, note); setMsg(r.ok ? (r.message ?? "") : (r.error ?? "Erreur.")); });
  return (
    <div className="mt-3 space-y-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note interne (facultatif)" aria-label="Note de décision" maxLength={500} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="danger" loading={pending} onClick={() => decide("accepted")}>Supprimer l&apos;avis</Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide("rejected")}>Conserver l&apos;avis</Button>
        {msg ? <span className="text-sm text-muted" role="status">{msg}</span> : null}
      </div>
    </div>
  );
}

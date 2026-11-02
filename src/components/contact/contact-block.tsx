"use client";

import { useState, useTransition, type ReactNode } from "react";
import { CheckCircle2, Phone } from "lucide-react";
import { CALLBACK_MOMENTS, telHref, type CallbackMoment, type ContactMode } from "@/lib/contact-mode";
import { requestCallback } from "@/server/actions/contact-mode";

export type ContactStyle = { input: string; button: string; ghost: string; muted: string };

/** Styles par défaut (pages Skydev) ; le mini-site passe les siens (couleurs du site). */
export const APP_CONTACT_STYLE: ContactStyle = {
  input: "h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30",
  button: "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-60",
  ghost: "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-surface-muted",
  muted: "text-sm text-muted",
};

/**
 * Bloc de contact d'une page publique, selon le réglage de l'entreprise :
 * « Appel uniquement » (bouton d'appel + horaires), « Rappelez-moi » (nom + numéro) ou le formulaire fourni (`form`).
 */
export function ContactBlock({ mode, slug, phone, note, about, pageUrl, form, style = APP_CONTACT_STYLE }: { mode: ContactMode; slug: string; phone: string | null; note: string | null; about?: string; pageUrl?: string; form?: ReactNode; style?: ContactStyle }) {
  if (mode === "phone" && phone)
    return (
      <div className="space-y-2">
        <a href={telHref(phone)} className={style.button}><Phone className="size-4" aria-hidden="true" />Appeler le {phone}</a>
        <p className={style.muted}>{note || "Appelez-nous pendant nos heures d'ouverture."}</p>
      </div>
    );
  if (mode === "callback") return <CallbackForm slug={slug} phone={phone} note={note} about={about} pageUrl={pageUrl} style={style} />;
  return <>{form}</>;
}

function CallbackForm({ slug, phone, note, about, pageUrl, style }: { slug: string; phone: string | null; note: string | null; about?: string; pageUrl?: string; style: ContactStyle }) {
  const [f, setF] = useState({ name: "", phone: "", moment: "any" as CallbackMoment, website: "" });
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (state?.ok)
    return (
      <p className="flex items-start gap-2 text-sm" role="status"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />{state.text}</p>
    );
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await requestCallback({ slug, ...f, about, pageUrl: pageUrl ?? (typeof window !== "undefined" ? window.location.pathname : undefined) });
          setState(r.ok ? { ok: true, text: r.message ?? "C'est noté." } : { ok: false, text: r.error });
        });
      }}
    >
      <p className={style.muted}>Laissez votre numéro : on vous rappelle.{note ? ` ${note}` : ""}</p>
      <label className="block"><span className="mb-1 block text-sm font-medium">Nom</span><input required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={style.input} /></label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Téléphone</span><input required type="tel" autoComplete="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={style.input} /></label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Quand vous rappeler ?</span>
        <select value={f.moment} onChange={(e) => setF({ ...f, moment: e.target.value as CallbackMoment })} className={style.input}>
          {Object.entries(CALLBACK_MOMENTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <div className="hidden" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></div>
      {state && !state.ok ? <p className="text-sm text-danger" role="alert">{state.text}</p> : null}
      <button type="submit" disabled={pending} className={style.button}>{pending ? "Envoi…" : "Être rappelé"}</button>
      {phone ? <a href={telHref(phone)} className={style.ghost}><Phone className="size-4" aria-hidden="true" />Ou appelez le {phone}</a> : null}
    </form>
  );
}

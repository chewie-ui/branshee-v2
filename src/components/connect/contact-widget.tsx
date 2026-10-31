"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { submitContactWidget } from "@/server/actions/connect";

/** Formulaire de contact intégré au site du pro : le message arrive dans Skydev (app Clients › Messages). */
export function ContactWidget({ slug, businessName, color }: { slug: string; businessName: string; color: string }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", subject: "", message: "", website: "" });
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const pageUrl = (() => { try { return document.referrer.slice(0, 500); } catch { return ""; } })();
      const r = await submitContactWidget({ slug, ...f, pageUrl }).catch(() => ({ ok: false as const, error: "Envoi impossible. Vérifiez votre connexion." }));
      if (!r.ok) return setError(r.error);
      setSent(r.message ?? "Message envoyé, merci !");
    });
  };
  const input = "h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-[15px] text-zinc-900 outline-none focus:border-[var(--c)] focus:ring-2 focus:ring-[var(--c)]/25";
  if (sent)
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center" role="status">
        <CheckCircle2 className="size-10" style={{ color }} aria-hidden="true" />
        <p className="text-lg font-semibold text-zinc-900">{sent}</p>
        <p className="text-sm text-zinc-600">{businessName} a bien reçu votre message.</p>
      </div>
    );
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" style={{ "--c": color } as React.CSSProperties} noValidate>
      <label className="text-sm font-medium text-zinc-800">Nom<input className={`${input} mt-1`} value={f.name} onChange={set("name")} required maxLength={120} autoComplete="name" /></label>
      <label className="text-sm font-medium text-zinc-800">Email<input className={`${input} mt-1`} type="email" value={f.email} onChange={set("email")} required maxLength={200} autoComplete="email" /></label>
      <label className="text-sm font-medium text-zinc-800">Téléphone <span className="font-normal text-zinc-500">(facultatif)</span><input className={`${input} mt-1`} type="tel" value={f.phone} onChange={set("phone")} maxLength={40} autoComplete="tel" /></label>
      <label className="text-sm font-medium text-zinc-800">Sujet <span className="font-normal text-zinc-500">(facultatif)</span><input className={`${input} mt-1`} value={f.subject} onChange={set("subject")} maxLength={200} /></label>
      <label className="text-sm font-medium text-zinc-800 sm:col-span-2">Message<textarea className={`${input} mt-1 h-auto min-h-32 py-2`} rows={5} value={f.message} onChange={set("message")} required maxLength={4000} /></label>
      <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2" role="alert">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-lg px-5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60" style={{ background: color, outlineColor: color }}>
          <Send className="size-4" aria-hidden="true" />{pending ? "Envoi…" : "Envoyer"}
        </button>
        <p className="text-xs text-zinc-500">Vos coordonnées servent uniquement à vous répondre.</p>
      </div>
    </form>
  );
}

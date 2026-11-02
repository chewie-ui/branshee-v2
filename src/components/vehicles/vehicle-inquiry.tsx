"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui/field";
import { sendVehicleInquiry } from "@/server/actions/connect";

/** « Je suis intéressé » : la demande arrive dans les messages du garage (app Clients), avec le véhicule concerné. */
export function VehicleInquiry({ slug, vehicle, title }: { slug: string; vehicle: string; title: string }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", message: `Bonjour, je suis intéressé(e) par la ${title}. Est-elle toujours disponible ? J'aimerais organiser un essai.`, website: "" });
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (state?.ok)
    return (
      <div className="flex items-start gap-3 rounded-xl bg-success-soft p-4 text-sm text-success" role="status">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />{state.text}
      </div>
    );
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); start(async () => setState(await sendVehicleInquiry({ slug, vehicle, ...f }).then((r) => (r.ok ? { ok: true, text: r.message ?? "Demande envoyée." } : { ok: false, text: r.error })))); }}
      className="space-y-3"
    >
      <Field label="Nom" htmlFor="vi-name"><Input id="vi-name" required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Email" htmlFor="vi-email"><Input id="vi-email" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Téléphone (facultatif)" htmlFor="vi-phone"><Input id="vi-phone" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label="Message" htmlFor="vi-message"><Textarea id="vi-message" rows={4} required value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
      <div className="hidden" aria-hidden="true"><label htmlFor="vi-website">Site web</label><input id="vi-website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></div>
      {state && !state.ok ? <p className="text-sm text-danger" role="alert">{state.text}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-60">{pending ? "Envoi…" : "Envoyer ma demande"}</button>
      <p className="text-xs text-muted">Vos coordonnées sont transmises uniquement à ce garage pour répondre à votre demande.</p>
    </form>
  );
}

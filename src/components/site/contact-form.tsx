"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { submitKeepingValues } from "@/lib/form";
import { sendContact, type ContactState } from "@/server/actions/contact";

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContact, undefined);
  const err = state?.fieldErrors ?? {};
  if (state?.ok)
    return (
      <div className="flex flex-col items-center py-10 text-center" role="status">
        <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold">Message envoyé</p>
        <p className="mt-1 max-w-sm text-sm text-muted">Merci ! Un membre de l&apos;équipe vous répond par email, généralement dans la journée.</p>
      </div>
    );
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4" noValidate>
      {state?.error ? <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{state.error}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nom" htmlFor="c-name" error={err.name}><Input id="c-name" name="name" autoComplete="name" defaultValue={state?.values?.name} aria-invalid={!!err.name || undefined} /></Field>
        <Field label="Email" htmlFor="c-email" error={err.email}><Input id="c-email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} aria-invalid={!!err.email || undefined} /></Field>
      </div>
      <Field label="Sujet" htmlFor="c-subject" error={err.subject}><Input id="c-subject" name="subject" defaultValue={state?.values?.subject} aria-invalid={!!err.subject || undefined} /></Field>
      <Field label="Message" htmlFor="c-message" error={err.message}>
        <textarea id="c-message" name="message" rows={6} defaultValue={state?.values?.message} aria-invalid={!!err.message || undefined} className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30 aria-invalid:border-danger" />
      </Field>
      <div className="hidden" aria-hidden="true"><label>Site web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <Button type="submit" loading={pending} className="w-full sm:w-auto">Envoyer le message</Button>
    </form>
  );
}

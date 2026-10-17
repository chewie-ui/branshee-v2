"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { requestPasswordReset, resetPassword, type ResetState } from "@/server/actions/password-reset";

export function ResetForm() {
  // Une seule machine à états : l'étape suivante dépend de la dernière réponse du serveur.
  const [state, action, pending] = useActionState<ResetState, FormData>(
    (prev, formData) => (formData.get("intent") === "reset" ? resetPassword(prev, formData) : requestPasswordReset(prev, formData)),
    undefined,
  );
  const onCodeStep = state?.step === "code";

  if (!onCodeStep) {
    return (
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="intent" value="request" />
        {state?.error ? <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{state.error}</p> : null}
        <Field label="Email du compte" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email} />
        </Field>
        <Button type="submit" loading={pending} className="w-full">
          Recevoir un code
        </Button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="intent" value="reset" />
      {state?.info ? <p className="rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success" role="status">{state.info}</p> : null}
      {state?.error ? <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{state.error}</p> : null}
      <input type="hidden" name="email" value={state?.email ?? ""} />
      <Field label="Code reçu par email" htmlFor="code" hint="6 chiffres, valable 15 minutes.">
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="tracking-[0.3em]" />
      </Field>
      <Field label="Nouveau mot de passe" htmlFor="password" hint="10 caractères minimum.">
        <PasswordInput id="password" name="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" loading={pending} className="w-full">
        Changer le mot de passe
      </Button>
    </form>
  );
}

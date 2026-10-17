"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { register, type AuthState } from "@/server/actions/auth";

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(register, undefined);
  const err = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.error ? (
        <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Field label="Nom complet" htmlFor="fullName" error={err.fullName}>
        <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={state?.values?.fullName} aria-invalid={!!err.fullName || undefined} />
      </Field>
      <Field label="Email professionnel" htmlFor="email" error={err.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} aria-invalid={!!err.email || undefined} />
      </Field>
      <Field label="Mot de passe" htmlFor="password" error={err.password} hint="10 caractères minimum.">
        <PasswordInput id="password" name="password" autoComplete="new-password" required aria-invalid={!!err.password || undefined} />
      </Field>
      <Button type="submit" loading={pending} className="w-full">
        Créer mon compte
      </Button>
    </form>
  );
}

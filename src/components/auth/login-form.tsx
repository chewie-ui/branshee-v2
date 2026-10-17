"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { login, type AuthState } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, undefined);
  const err = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state?.error ? (
        <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Field label="Email" htmlFor="email" error={err.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} aria-invalid={!!err.email || undefined} />
      </Field>
      <Field label="Mot de passe" htmlFor="password" error={err.password}>
        <PasswordInput id="password" name="password" autoComplete="current-password" required aria-invalid={!!err.password || undefined} />
      </Field>
      <div className="-mt-2 text-right">
        <Link href="/mot-de-passe-oublie" className="text-sm font-medium text-accent hover:text-accent-hover">
          Mot de passe oublié ?
        </Link>
      </div>
      <Button type="submit" loading={pending} className="w-full">
        Se connecter
      </Button>
    </form>
  );
}

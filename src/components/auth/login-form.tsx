"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { login, type AuthState } from "@/server/actions/auth";
import { submitKeepingValues } from "@/lib/form";
import { AUTH_T, authMsg } from "@/lib/auth-i18n";
import { localize, type SiteLocale } from "@/lib/site-locale";

export function LoginForm({ next, locale = "fr" }: { next?: string; locale?: SiteLocale }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, undefined);
  const f = state?.fieldErrors ?? {};
  const err = { email: authMsg(f.email, locale), password: authMsg(f.password, locale) };
  const t = AUTH_T[locale];
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state?.error ? (
        <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">
          {authMsg(state.error, locale)}
        </p>
      ) : null}
      <Field label={t.email} htmlFor="email" error={err.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} aria-invalid={!!err.email || undefined} />
      </Field>
      <Field label={t.password} htmlFor="password" error={err.password}>
        <PasswordInput id="password" name="password" autoComplete="current-password" required aria-invalid={!!err.password || undefined} />
      </Field>
      <div className="-mt-2 text-right">
        <Link href={localize("/mot-de-passe-oublie", locale)} className="text-sm font-medium text-accent hover:text-accent-hover">
          {t.forgot}
        </Link>
      </div>
      <Button type="submit" loading={pending} className="w-full">
        {t.login}
      </Button>
    </form>
  );
}

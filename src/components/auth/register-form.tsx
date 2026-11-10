"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { register, type AuthState } from "@/server/actions/auth";
import { submitKeepingValues } from "@/lib/form";
import { AUTH_T, authMsg } from "@/lib/auth-i18n";
import type { SiteLocale } from "@/lib/site-locale";

export function RegisterForm({ client = false, next, refCode, defaults = {}, locale = "fr" }: { client?: boolean; next?: string; refCode?: string; defaults?: { email?: string; fullName?: string }; locale?: SiteLocale }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(register, undefined);
  const f = state?.fieldErrors ?? {};
  const err = { fullName: authMsg(f.fullName, locale), email: authMsg(f.email, locale), password: authMsg(f.password, locale) };
  const t = AUTH_T[locale];
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4" noValidate>
      {state?.error ? (
        <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">
          {authMsg(state.error, locale)}
        </p>
      ) : null}
      {client ? <input type="hidden" name="kind" value="client" /> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {refCode ? <input type="hidden" name="ref" value={refCode} /> : null}
      <input type="hidden" name="lang" value={locale} />
      <Field label={t.fullName} htmlFor="fullName" error={err.fullName}>
        <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={state?.values?.fullName ?? defaults.fullName} aria-invalid={!!err.fullName || undefined} />
      </Field>
      <Field label={client ? t.email : t.proEmail} htmlFor="email" error={err.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email ?? defaults.email} aria-invalid={!!err.email || undefined} />
      </Field>
      <Field label={t.password} htmlFor="password" error={err.password} hint={t.min10}>
        <PasswordInput id="password" name="password" autoComplete="new-password" required aria-invalid={!!err.password || undefined} />
      </Field>
      <Button type="submit" loading={pending} className="w-full">
        {t.create}
      </Button>
    </form>
  );
}

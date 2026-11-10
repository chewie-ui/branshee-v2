"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { submitKeepingValues } from "@/lib/form";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { AUTH_T, authMsg } from "@/lib/auth-i18n";
import type { SiteLocale } from "@/lib/site-locale";
import { requestPasswordReset, resetPassword, type ResetState } from "@/server/actions/password-reset";

export function ResetForm({ locale = "fr" }: { locale?: SiteLocale }) {
  const t = AUTH_T[locale];
  // Une seule machine à états : l'étape suivante dépend de la dernière réponse du serveur.
  const [state, action, pending] = useActionState<ResetState, FormData>(
    (prev, formData) => (formData.get("intent") === "reset" ? resetPassword(prev, formData) : requestPasswordReset(prev, formData)),
    undefined,
  );
  const onCodeStep = state?.step === "code";

  if (!onCodeStep) {
    return (
      <form onSubmit={submitKeepingValues(action)} className="space-y-4" noValidate>
        <input type="hidden" name="intent" value="request" />
        {state?.error ? <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{authMsg(state.error, locale)}</p> : null}
        <Field label={t.accountEmail} htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email} />
        </Field>
        <Button type="submit" loading={pending} className="w-full">
          {t.getCode}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4" noValidate>
      <input type="hidden" name="intent" value="reset" />
      {state?.info ? <p className="rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success" role="status">{authMsg(state.info, locale)}</p> : null}
      {state?.error ? <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{authMsg(state.error, locale)}</p> : null}
      <input type="hidden" name="email" value={state?.email ?? ""} />
      <Field label={t.code} htmlFor="code" hint={t.codeHint}>
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="tracking-[0.3em]" />
      </Field>
      <Field label={t.newPw} htmlFor="password" hint={t.min10}>
        <PasswordInput id="password" name="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" loading={pending} className="w-full">
        {t.change}
      </Button>
    </form>
  );
}

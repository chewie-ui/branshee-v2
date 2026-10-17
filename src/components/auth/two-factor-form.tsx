"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { verifyLoginTwoFactor, type TwoFactorState } from "@/server/actions/auth";

export function TwoFactorForm() {
  const [state, action, pending] = useActionState<TwoFactorState, FormData>(verifyLoginTwoFactor, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error ? <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{state.error}</p> : null}
      <Field label="Code" htmlFor="code">
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus className="text-center text-lg tracking-[0.4em]" />
      </Field>
      <Button type="submit" loading={pending} className="w-full">Valider</Button>
    </form>
  );
}

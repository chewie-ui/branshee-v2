"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { resendVerification, verifyEmail } from "@/server/actions/account";

type R = { ok: true; message?: string } | { ok: false; error: string } | undefined;

export function VerifyEmailForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<R, FormData>(verifyEmail, undefined);
  const [info, setInfo] = useState<string | null>(null);
  const [sending, start] = useTransition();
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state && !state.ok ? <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{state.error}</p> : null}
      {info ? <p className="rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success" role="status">{info}</p> : null}
      <Field label="Code" htmlFor="code">
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus className="text-center text-lg tracking-[0.4em]" />
      </Field>
      <Button type="submit" loading={pending} className="w-full">Confirmer</Button>
      <button
        type="button"
        disabled={sending}
        onClick={() => start(async () => { const r = await resendVerification(); setInfo(r.ok ? (r.message ?? "Code envoyé.") : r.error); })}
        className="w-full text-center text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-50"
      >
        Renvoyer un code
      </button>
    </form>
  );
}

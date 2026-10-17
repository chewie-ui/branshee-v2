"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { SettingsState } from "@/server/actions/settings";
import { submitKeepingValues } from "@/lib/form";

type Action = (prev: SettingsState, fd: FormData) => Promise<SettingsState>;

/** Formulaire de réglages : sections, bouton Enregistrer et message de résultat. */
export function SettingsForm({ action, children }: { action: Action; children: (errors: Record<string, string>) => ReactNode }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(action, undefined);
  return (
    <form onSubmit={submitKeepingValues(formAction)} className="space-y-6" noValidate>
      {children(state?.fieldErrors ?? {})}
      <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:rounded-xl sm:border sm:bg-surface sm:px-5">
        {state?.error ? (
          <p className="text-sm text-danger sm:mr-auto" role="alert">{state.error}</p>
        ) : state?.ok ? (
          <p className="text-sm text-success sm:mr-auto" role="status">Modifications enregistrées.</p>
        ) : null}
        <Button type="submit" loading={pending}>Enregistrer</Button>
      </div>
    </form>
  );
}

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </header>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

export function Toggle({ name, label, description, defaultChecked }: { name: string; label: string; description?: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
      <span>
        <span className="font-medium">{label}</span>
        {description ? <span className="block text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { createAppointment, fetchFreeSlots, type CreateAppointmentState } from "@/server/actions/appointments";
import { cn } from "@/lib/cn";
import { formatDuration, formatPrice } from "@/lib/time";

type Props = {
  services: { id: string; name: string; durationMin: number; priceCents: number | null; category: string | null }[];
  members: { id: string; name: string }[];
  customers: { id: string; name: string; email: string | null }[];
  defaultDate: string;
};

export function NewAppointmentForm({ services, members, customers, defaultDate }: Props) {
  const [state, action, pending] = useActionState<CreateAppointmentState, FormData>(createAppointment, undefined);
  const [mode, setMode] = useState<"existing" | "new">(customers.length ? "existing" : "new");
  const err = state?.fieldErrors ?? {};

  // Sélection courante : sert à proposer les créneaux libres du membre ce jour-là.
  const [sel, setSel] = useState({ serviceId: "", memberId: members.length === 1 ? members[0]!.id : "", date: defaultDate });
  const [time, setTime] = useState("09:00");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadingSlots, startSlots] = useTransition();

  function update(patch: Partial<typeof sel>) {
    const next = { ...sel, ...patch };
    setSel(next);
    if (!next.serviceId || !next.memberId || !next.date) return setSlots(null);
    startSlots(async () => setSlots(await fetchFreeSlots(next.serviceId, next.memberId, next.date)));
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      {state?.error ? (
        <p className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}

      <Card className="space-y-5 p-5">
        <h2 className="text-base font-semibold">Client</h2>
        <div className="inline-flex rounded-lg border border-border bg-surface-muted p-1" role="radiogroup" aria-label="Type de client">
          {(["existing", "new"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              disabled={m === "existing" && customers.length === 0}
              className={`h-8 rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${mode === m ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"}`}
            >
              {m === "existing" ? "Client existant" : "Nouveau client"}
            </button>
          ))}
        </div>

        {mode === "existing" ? (
          <Field label="Client" htmlFor="customerId" error={err.newName}>
            <Select id="customerId" name="customerId" defaultValue="" aria-invalid={!!err.newName || undefined}>
              <option value="" disabled>
                Choisir un client…
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.email ? ` — ${c.email}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="customerId" value="" />
            <Field label="Nom complet" htmlFor="newName" error={err.newName} className="sm:col-span-3">
              <Input id="newName" name="newName" autoComplete="off" aria-invalid={!!err.newName || undefined} />
            </Field>
            <Field label="Email" htmlFor="newEmail" error={err.newEmail} hint="Facultatif." className="sm:col-span-2">
              <Input id="newEmail" name="newEmail" type="email" autoComplete="off" aria-invalid={!!err.newEmail || undefined} />
            </Field>
            <Field label="Téléphone" htmlFor="newPhone" error={err.newPhone}>
              <Input id="newPhone" name="newPhone" type="tel" autoComplete="off" />
            </Field>
          </div>
        )}
      </Card>

      <Card className="space-y-5 p-5">
        <h2 className="text-base font-semibold">Rendez-vous</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prestation" htmlFor="serviceId" error={err.serviceId}>
            <Select id="serviceId" name="serviceId" value={sel.serviceId} onChange={(e) => update({ serviceId: e.target.value })} aria-invalid={!!err.serviceId || undefined}>
              <option value="" disabled>
                Choisir une prestation…
              </option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.durationMin)}
                  {s.priceCents != null ? ` · ${formatPrice(s.priceCents)}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Avec" htmlFor="memberId" error={err.memberId}>
            <Select id="memberId" name="memberId" value={sel.memberId} onChange={(e) => update({ memberId: e.target.value })} aria-invalid={!!err.memberId || undefined}>
              <option value="" disabled>
                Choisir…
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="date" error={err.date}>
            <Input id="date" name="date" type="date" value={sel.date} onChange={(e) => update({ date: e.target.value })} aria-invalid={!!err.date || undefined} />
          </Field>
          <Field label="Heure" htmlFor="time" error={err.time}>
            <Input id="time" name="time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} aria-invalid={!!err.time || undefined} />
          </Field>
        </div>
        {sel.serviceId && sel.memberId && sel.date ? (
          <div aria-live="polite">
            <p className="mb-2 text-sm font-medium">Créneaux libres ce jour-là</p>
            {loadingSlots ? (
              <div className="flex gap-2" aria-label="Chargement des créneaux">
                {[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-8 w-16 animate-pulse rounded-lg bg-surface-muted" />)}
              </div>
            ) : slots && slots.length ? (
              <div className="flex flex-wrap gap-2">
                {slots.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTime(t)}
                    aria-pressed={time === t}
                    className={cn("h-8 rounded-lg border px-3 text-sm font-medium tabular-nums transition-colors", time === t ? "border-accent bg-accent text-accent-foreground" : "border-border-strong bg-surface hover:border-accent hover:text-accent")}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Aucun créneau libre selon les horaires. Vous pouvez quand même saisir une heure.</p>
            )}
          </div>
        ) : null}
        <Field label="Note interne" htmlFor="note" hint="Visible uniquement par votre équipe.">
          <Textarea id="note" name="note" rows={3} />
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="mt-0.5 size-4 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">Envoyer la confirmation au client par email</span>
            <span className="block text-muted">Uniquement si le client a une adresse email.</span>
          </span>
        </label>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/app/agenda" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface-muted hover:text-text">
          Annuler
        </Link>
        <Button type="submit" loading={pending}>
          Créer le rendez-vous
        </Button>
      </div>
    </form>
  );
}

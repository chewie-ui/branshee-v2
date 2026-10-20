"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarPlus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { createAppointment, fetchFreeSlots, type CreateAppointmentState } from "@/server/actions/appointments";
import { cn } from "@/lib/cn";
import { formatDuration, formatPrice } from "@/lib/time";
import { hhmmOf, minutesOf, parseQuickTime } from "@/lib/time-input";
import { submitKeepingValues } from "@/lib/form";

type Customer = { id: string; name: string; email: string | null; phone: string | null };
type Props = {
  services: { id: string; name: string; durationMin: number; durationMaxMin: number | null; priceCents: number | null; category: string | null }[];
  members: { id: string; name: string }[];
  customers: Customer[];
  defaultDate: string;
  defaultTime?: string;
  /** Durée choisie en sélectionnant une plage dans l'agenda. */
  defaultDuration?: number;
  defaultMemberId?: string;
  defaultCustomerId?: string;
  clientTerm: string;
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function NewAppointmentForm({ services, members, customers, defaultDate, defaultTime, defaultDuration, defaultMemberId, defaultCustomerId, clientTerm }: Props) {
  const [state, action, pending] = useActionState<CreateAppointmentState, FormData>(createAppointment, undefined);
  const err = state?.fieldErrors ?? {};

  // Client : recherche dans les fiches existantes, sinon nouveau client.
  const [customer, setCustomer] = useState<Customer | null>(customers.find((c) => c.id === defaultCustomerId) ?? null);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (q.length < 2) return [];
    return customers.filter((c) => fold(`${c.name} ${c.email ?? ""} ${c.phone ?? ""}`).includes(q)).slice(0, 8);
  }, [query, customers]);

  const [serviceId, setServiceId] = useState("");
  const [memberId, setMemberId] = useState(defaultMemberId ?? (members.length === 1 ? members[0]!.id : ""));
  const [duration, setDuration] = useState(defaultDuration ?? 30);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime ?? "09:00");
  const [extra, setExtra] = useState<{ date: string; time: string }[]>([]);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadingSlots, startSlots] = useTransition();

  const parsedTime = parseQuickTime(time);
  const end = parsedTime ? hhmmOf(Math.min(minutesOf(parsedTime) + duration, 24 * 60 - 1)) : null;

  function refreshSlots(next: { serviceId?: string; memberId?: string; date?: string }) {
    const s = next.serviceId ?? serviceId;
    const m = next.memberId ?? memberId;
    const d = next.date ?? date;
    if (!s || !d) return setSlots(null);
    startSlots(async () => setSlots(await fetchFreeSlots(s, m, d)));
  }

  function pickService(id: string) {
    setServiceId(id);
    const s = services.find((x) => x.id === id);
    // Durée en fourchette : on réserve la durée maximale pour ne jamais déborder.
    if (s) setDuration(s.durationMaxMin ?? s.durationMin);
    refreshSlots({ serviceId: id });
  }

  const allSlots = [{ date, time }, ...extra];

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-6" noValidate>
      {state?.error ? (
        <p className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="slots" value={JSON.stringify(allSlots)} />
      <input type="hidden" name="customerId" value={customer?.id ?? ""} />

      <Card className="space-y-4 p-5">
        <h2 className="text-base font-semibold first-letter:uppercase">{clientTerm}</h2>
        {customer ? (
          <div className="flex items-center gap-3 rounded-lg border border-accent bg-accent-soft px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{customer.name}</p>
              <p className="truncate text-sm text-muted">{[customer.email, customer.phone].filter(Boolean).join(" · ") || "Sans coordonnées"}</p>
            </div>
            <button type="button" onClick={() => setCustomer(null)} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover">
              <X className="size-4" aria-hidden="true" />
              Changer
            </button>
          </div>
        ) : (
          <>
            {customers.length > 0 ? (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Rechercher un ${clientTerm} existant (nom, email, téléphone)…`} className="pl-9" aria-label={`Rechercher un ${clientTerm}`} autoComplete="off" />
                {matches.length ? (
                  <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                    {matches.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => { setCustomer(c); setQuery(""); }} className="block w-full px-4 py-2.5 text-left hover:bg-surface-muted">
                          <span className="block text-sm font-medium">{c.name}</span>
                          <span className="block truncate text-xs text-muted">{[c.email, c.phone].filter(Boolean).join(" · ")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <p className="text-sm text-muted">{customers.length > 0 ? `Ou remplissez les champs ci-dessous pour un nouveau ${clientTerm}.` : `Nouveau ${clientTerm} :`}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Prénom" htmlFor="newFirstName" error={err.newFirstName}>
                <Input id="newFirstName" name="newFirstName" autoComplete="off" aria-invalid={!!err.newFirstName || undefined} />
              </Field>
              <Field label="Nom" htmlFor="newLastName">
                <Input id="newLastName" name="newLastName" autoComplete="off" />
              </Field>
              <Field label="Email (facultatif)" htmlFor="newEmail" error={err.newEmail}>
                <Input id="newEmail" name="newEmail" type="email" autoComplete="off" aria-invalid={!!err.newEmail || undefined} />
              </Field>
              <Field label="Téléphone (facultatif)" htmlFor="newPhone">
                <Input id="newPhone" name="newPhone" type="tel" autoComplete="off" />
              </Field>
            </div>
          </>
        )}
      </Card>

      <Card className="space-y-5 p-5">
        <h2 className="text-base font-semibold">Rendez-vous</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Prestation" htmlFor="serviceId">
            <Select id="serviceId" name="serviceId" value={serviceId} onChange={(e) => pickService(e.target.value)}>
              <option value="">Aucune prestation</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.durationMin, s.durationMaxMin)}
                  {s.priceCents != null ? ` · ${formatPrice(s.priceCents)}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Avec" htmlFor="memberId">
            <Select id="memberId" name="memberId" value={memberId} onChange={(e) => { setMemberId(e.target.value); refreshSlots({ memberId: e.target.value }); }}>
              {members.length > 1 ? <option value="">Le premier disponible</option> : null}
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="date">
            <Input id="date" type="date" value={date} onChange={(e) => { setDate(e.target.value); refreshSlots({ date: e.target.value }); }} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Heure" htmlFor="time" error={err.slots} hint={end ? `Fin à ${end}` : "Ex. 9, 0930 ou 14h30"}>
              <Input id="time" value={time} onChange={(e) => setTime(e.target.value)} onBlur={() => parsedTime && setTime(parsedTime)} inputMode="numeric" aria-invalid={!parsedTime || undefined} />
            </Field>
            <Field label="Durée (min)" htmlFor="durationMin" error={err.durationMin}>
              <Input id="durationMin" name="durationMin" type="number" min={5} max={720} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 0)} />
            </Field>
          </div>
        </div>

        {serviceId && date ? (
          <div aria-live="polite">
            <p className="mb-2 text-sm font-medium">Créneaux libres ce jour-là</p>
            {loadingSlots ? (
              <div className="flex gap-2" aria-label="Chargement des créneaux">
                {[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-8 w-16 animate-pulse rounded-lg bg-surface-muted" />)}
              </div>
            ) : slots && slots.length ? (
              <div className="flex flex-wrap gap-2">
                {slots.map((t) => (
                  <button key={t} type="button" onClick={() => setTime(t)} aria-pressed={parsedTime === t} className={cn("h-8 rounded-lg border px-3 text-sm font-medium tabular-nums transition-colors", parsedTime === t ? "border-accent bg-accent text-accent-foreground" : "border-border-strong bg-surface hover:border-accent hover:text-accent")}>
                    {t}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Aucun créneau libre selon les horaires. Vous pouvez quand même saisir une heure.</p>
            )}
          </div>
        ) : null}

        {/* Plusieurs rendez-vous d'un coup (ex. une série de séances). */}
        <div className="space-y-2">
          {extra.map((x, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input type="date" value={x.date} onChange={(e) => setExtra((l) => l.map((y, j) => (j === i ? { ...y, date: e.target.value } : y)))} className="w-44" aria-label={`Date ${i + 2}`} />
              <Input value={x.time} onChange={(e) => setExtra((l) => l.map((y, j) => (j === i ? { ...y, time: e.target.value } : y)))} onBlur={() => { const p = parseQuickTime(x.time); if (p) setExtra((l) => l.map((y, j) => (j === i ? { ...y, time: p } : y))); }} className="w-28" aria-label={`Heure ${i + 2}`} />
              <button type="button" onClick={() => setExtra((l) => l.filter((_, j) => j !== i))} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label={`Retirer la date ${i + 2}`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={extra.length >= 19}
            onClick={() => {
              const last = extra.at(-1) ?? { date, time: parsedTime ?? time };
              const d = new Date(last.date + "T12:00:00Z");
              d.setUTCDate(d.getUTCDate() + 7);
              setExtra((l) => [...l, { date: d.toISOString().slice(0, 10), time: last.time }]);
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-40"
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            Ajouter une autre date
          </button>
          <p className="text-xs text-muted">Pour créer plusieurs rendez-vous d&apos;un coup (une semaine plus tard par défaut).</p>
        </div>

        <Field label="Note interne" htmlFor="note" hint="Visible uniquement par votre équipe.">
          <Textarea id="note" name="note" rows={3} />
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="mt-0.5 size-4 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">Envoyer la confirmation par email</span>
            <span className="block text-muted">Uniquement si le {clientTerm} a une adresse email.</span>
          </span>
        </label>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/app/agenda" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface-muted hover:text-text">
          Annuler
        </Link>
        <Button type="submit" loading={pending}>
          {extra.length ? `Créer les ${extra.length + 1} rendez-vous` : "Créer le rendez-vous"}
        </Button>
      </div>
    </form>
  );
}

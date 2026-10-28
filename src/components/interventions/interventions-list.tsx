"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, FileText, MapPin, Plus, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { INTERVENTION_STATUS, type InterventionStatus } from "@/lib/interventions";
import { saveIntervention } from "@/server/actions/interventions";

type Row = { id: string; number: number; title: string; client: string; address: string | null; status: string; scheduledAt: string | null; tech: string | null; techId: string | null; signed: boolean; invoiced: boolean };
type Opt = { id: string; name: string };
const STATUS_CLS: Record<string, string> = { planned: "bg-surface-muted text-muted", onroute: "bg-accent-soft text-accent", working: "bg-warning-soft text-warning", done: "bg-success-soft text-success", cancelled: "bg-danger-soft text-danger" };

export function InterventionsList({ rows, view, team, clients, canManage, tz }: { rows: Row[]; view: "todo" | "mine" | "done"; team: Opt[]; clients: Opt[]; canManage: boolean; tz: string }) {
  const [open, setOpen] = useState(false);
  const dayFmt = new Intl.DateTimeFormat("fr-BE", { timeZone: tz, weekday: "long", day: "numeric", month: "long" });
  const timeFmt = new Intl.DateTimeFormat("fr-BE", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.scheduledAt ? dayFmt.format(new Date(r.scheduledAt)) : "Sans date";
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-surface-muted p-1" role="group" aria-label="Interventions affichées">
          {([["todo", "À faire", "/app/interventions"], ["mine", "Les miennes", "/app/interventions?vue=moi"], ["done", "Terminées", "/app/interventions?vue=terminees"]] as const).map(([k, l, href]) => <Link key={k} href={href} aria-current={view === k ? "page" : undefined} className={cn("h-8 rounded-md px-3 text-sm leading-8 font-medium", view === k ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>{l}</Link>)}
        </div>
        {canManage ? <Button className="ml-auto" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setOpen(true)}>Nouvelle intervention</Button> : null}
      </div>
      {rows.length === 0 ? (
        <Card className="p-8 text-center">
          <Truck className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-medium">{view === "done" ? "Aucune intervention terminée" : "Aucune intervention prévue"}</p>
          {view !== "done" ? <p className="mx-auto mt-1 max-w-md text-sm text-muted">Planifiez une intervention chez un client et confiez-la à un technicien : il la suit sur son téléphone, prend les photos et fait signer le client.</p> : null}
        </Card>
      ) : (
        [...groups].map(([day, list]) => (
          <section key={day} aria-label={day}>
            <h2 className="mb-2 text-sm font-semibold first-letter:uppercase">{day}</h2>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {list.map((r) => (
                  <li key={r.id}>
                    <Link href={`/app/interventions/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{r.scheduledAt ? timeFmt.format(new Date(r.scheduledAt)) : "—"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.title} <span className="font-normal text-muted">· n° {r.number}</span></span>
                        <span className="flex flex-wrap gap-x-3 text-sm text-muted"><span className="truncate">{r.client}</span>{r.address ? <span className="inline-flex min-w-0 items-center gap-1 truncate"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{r.address}</span> : null}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm text-muted"><UserRound className="size-3.5" aria-hidden="true" />{r.tech ?? "À attribuer"}</span>
                      <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", STATUS_CLS[r.status])}>{INTERVENTION_STATUS[r.status as InterventionStatus]?.label ?? r.status}</span>
                      {r.signed ? <Check className="size-4 text-success" aria-label="Signée par le client" /> : null}
                      {r.invoiced ? <FileText className="size-4 text-muted" aria-label="Facturée" /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}
      {open ? <InterventionDialog team={team} clients={clients} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

export type InterventionInitial = { id: string; customerId: string | null; clientName: string; clientPhone: string | null; clientEmail: string | null; address: string | null; title: string; description: string | null; technicianId: string | null; scheduledLocal: string; durationMinutes: number };

/** Planifier / modifier une intervention. */
export function InterventionDialog({ team, clients, initial, onClose }: { team: Opt[]; clients: Opt[]; initial?: InterventionInitial; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [f, setF] = useState({ customerId: initial?.customerId ?? "", clientName: initial?.clientName ?? "", clientPhone: initial?.clientPhone ?? "", clientEmail: initial?.clientEmail ?? "", address: initial?.address ?? "", title: initial?.title ?? "", description: initial?.description ?? "", technicianId: initial?.technicianId ?? (team.length === 1 ? team[0]!.id : ""), when: initial?.scheduledLocal ?? "", duration: String(initial?.durationMinutes ?? 60) });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input,select")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const r = await saveIntervention({ id: initial?.id, customerId: f.customerId, clientName: f.clientName, clientPhone: f.clientPhone, clientEmail: f.clientEmail, address: f.address, title: f.title, description: f.description, technicianId: f.technicianId, scheduledAt: f.when ? new Date(f.when).toISOString() : "", durationMinutes: Number(f.duration) }).catch(() => ({ ok: false as const, error: "Envoi impossible. Vérifiez votre connexion." }));
      if (!r.ok) return setError(r.error);
      onClose();
      if (!initial && r.url) router.push(r.url); else router.refresh();
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="iv-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <form ref={ref} onSubmit={submit} className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl" noValidate>
        <h2 id="iv-title" className="text-lg font-semibold">{initial ? "Modifier l'intervention" : "Nouvelle intervention"}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Quoi" htmlFor="iv-title-in" className="sm:col-span-2"><Input id="iv-title-in" value={f.title} onChange={set("title")} maxLength={160} placeholder="Ex. : Entretien chaudière" /></Field>
          {clients.length ? (
            <Field label="Client existant" htmlFor="iv-cust" className="sm:col-span-2">
              <Select id="iv-cust" value={f.customerId} onChange={set("customerId")}><option value="">Nouveau client (à taper ci-dessous)</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            </Field>
          ) : null}
          {!f.customerId ? (
            <>
              <Field label="Nom du client" htmlFor="iv-name"><Input id="iv-name" value={f.clientName} onChange={set("clientName")} maxLength={120} /></Field>
              <Field label="Téléphone" htmlFor="iv-phone"><Input id="iv-phone" type="tel" value={f.clientPhone} onChange={set("clientPhone")} maxLength={40} /></Field>
              <Field label="Email (pour le rapport)" htmlFor="iv-email" className="sm:col-span-2"><Input id="iv-email" type="email" value={f.clientEmail} onChange={set("clientEmail")} maxLength={200} /></Field>
            </>
          ) : null}
          <Field label="Adresse" htmlFor="iv-addr" className="sm:col-span-2"><Input id="iv-addr" value={f.address} onChange={set("address")} maxLength={300} placeholder={f.customerId ? "Laissée vide : adresse de la fiche client" : "Rue, numéro, code postal, ville"} /></Field>
          <Field label="Quand" htmlFor="iv-when"><Input id="iv-when" type="datetime-local" value={f.when} onChange={set("when")} /></Field>
          <Field label="Durée prévue" htmlFor="iv-dur"><Select id="iv-dur" value={f.duration} onChange={set("duration")}>{[30, 60, 90, 120, 180, 240, 480].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}</Select></Field>
          <Field label="Technicien" htmlFor="iv-tech" className="sm:col-span-2"><Select id="iv-tech" value={f.technicianId} onChange={set("technicianId")}><option value="">À attribuer</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
          <Field label="Détails pour le technicien" htmlFor="iv-desc" className="sm:col-span-2"><Textarea id="iv-desc" rows={3} value={f.description} onChange={set("description")} maxLength={4000} placeholder="Code de la porte, matériel à prendre…" /></Field>
        </div>
        {error ? <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button type="submit" loading={pending} icon={<CalendarClock className="size-4" aria-hidden="true" />}>{initial ? "Enregistrer" : "Planifier"}</Button>
        </div>
      </form>
    </div>
  );
}

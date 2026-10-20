"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Ban, GitMerge, Link2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { submitKeepingValues } from "@/lib/form";
import {
  createCustomer,
  deleteCustomerAndLeave,
  mergeCustomers,
  reassignAppointment,
  saveAltContacts,
  saveContact,
  saveGeneralInfo,
  searchCustomers,
  setCustomerBlocked,
  type CustomerState,
} from "@/server/actions/customers";

const Saved = ({ state }: { state: CustomerState }) => (state?.ok ? <span className="text-sm text-success" role="status">Enregistré.</span> : state?.error ? <span className="text-sm text-danger" role="alert">{state.error}</span> : null);

export function ContactForm({ customerId, c, hasAccount = false }: { customerId: string; c: { firstName: string; lastName: string; email: string; phone: string }; hasAccount?: boolean }) {
  const [state, action, pending] = useActionState<CustomerState, FormData>(saveContact.bind(null, customerId), undefined);
  const err = state?.fieldErrors ?? {};
  return (
    <Card>
      <CardHeader
        title="Coordonnées"
        description={
          hasAccount
            ? "Ce patient a un compte Branshee : ces coordonnées ne concernent que votre fiche. Son compte, son email de connexion et ses autres rendez-vous ne changent pas."
            : "L'email et le téléphone rattachent les futurs rendez-vous à cette fiche. Ils ne concernent que votre établissement."
        }
      />
      <form onSubmit={submitKeepingValues(action)} className="space-y-4 p-5" noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Prénom" htmlFor="c-first" error={err.firstName}><Input id="c-first" name="firstName" defaultValue={c.firstName} aria-invalid={!!err.firstName || undefined} /></Field>
          <Field label="Nom" htmlFor="c-last"><Input id="c-last" name="lastName" defaultValue={c.lastName} /></Field>
        </div>
        <Field label="Email" htmlFor="c-email" error={err.email}><Input id="c-email" name="email" type="email" defaultValue={c.email} placeholder="prenom@exemple.be" aria-invalid={!!err.email || undefined} /></Field>
        <Field label="Téléphone" htmlFor="c-phone"><Input id="c-phone" name="phone" type="tel" defaultValue={c.phone} /></Field>
        <div className="flex items-center justify-end gap-3"><Saved state={state} /><Button type="submit" size="sm" loading={pending}>Enregistrer</Button></div>
      </form>
    </Card>
  );
}

export function AltContactsForm({ customerId, c }: { customerId: string; c: { altName: string; altEmail: string; altPhone: string } }) {
  const [state, action, pending] = useActionState<CustomerState, FormData>(saveAltContacts.bind(null, customerId), undefined);
  const err = state?.fieldErrors ?? {};
  return (
    <Card>
      <CardHeader title="Contacts alternatifs" />
      <form onSubmit={submitKeepingValues(action)} className="space-y-4 p-5" noValidate>
        <Field label="Autre nom / surnom" htmlFor="a-name"><Input id="a-name" name="altName" defaultValue={c.altName} placeholder="Ex. surnom, nom de jeune fille…" /></Field>
        <Field label="Autre email" htmlFor="a-email" error={err.altEmail}><Input id="a-email" name="altEmail" type="email" defaultValue={c.altEmail} aria-invalid={!!err.altEmail || undefined} /></Field>
        <Field label="Autre téléphone" htmlFor="a-phone"><Input id="a-phone" name="altPhone" type="tel" defaultValue={c.altPhone} /></Field>
        <div className="flex items-center justify-end gap-3"><Saved state={state} /><Button type="submit" size="sm" variant="secondary" loading={pending}>Enregistrer</Button></div>
      </form>
    </Card>
  );
}

export function GeneralNotes({ customerId, initial, canManage }: { customerId: string; initial: string; canManage: boolean }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Card data-tour="customer-general">
      <CardHeader title="Notes générales" description="Ce qu'il faut savoir à chaque visite. Chiffré." />
      <div className="space-y-3 p-5">
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} maxLength={5000} readOnly={!canManage} placeholder="Ex. allergique aux arachides, préfère le matin, fidèle depuis 2019…" aria-label="Notes générales" />
        {canManage ? (
          <div className="flex items-center justify-end gap-3">
            {value === saved && saved !== initial ? <span className="text-sm text-success" role="status">Enregistré.</span> : null}
            <Button size="sm" variant="secondary" disabled={value === saved} loading={pending} onClick={() => start(async () => { const r = await saveGeneralInfo(customerId, value); if (r.ok) setSaved(value); })}>Enregistrer</Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** Actions de la fiche : bloquer, fusionner, supprimer. */
export function CustomerActions({ customerId, name, blocked, blockedReason, term }: { customerId: string; name: string; blocked: boolean; blockedReason: string; term: string }) {
  const [mode, setMode] = useState<"block" | "merge" | "delete" | null>(null);
  const [reason, setReason] = useState(blockedReason);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader title="Actions" />
      <div className="space-y-3 p-5">
        {blocked ? (
          <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
            Ce {term} ne peut plus réserver en ligne{blockedReason ? ` (${blockedReason})` : ""}.
            <Button size="sm" variant="secondary" className="mt-2" loading={pending} onClick={() => start(async () => void (await setCustomerBlocked(customerId, false, "")))}>Débloquer</Button>
          </div>
        ) : mode === "block" ? (
          <div className="space-y-2">
            <Field label="Motif (facultatif, interne)" htmlFor="block-reason"><Input id="block-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Ex. absences répétées" /></Field>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Annuler</Button>
              <Button size="sm" variant="danger" loading={pending} onClick={() => start(async () => { await setCustomerBlocked(customerId, true, reason); setMode(null); })}>Bloquer</Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" className="w-full" icon={<Ban className="size-4" aria-hidden="true" />} onClick={() => setMode("block")}>Bloquer la réservation en ligne</Button>
        )}

        {mode === "merge" ? (
          <MergePicker customerId={customerId} name={name} term={term} onCancel={() => setMode(null)} />
        ) : (
          <Button variant="secondary" className="w-full" icon={<GitMerge className="size-4" aria-hidden="true" />} onClick={() => setMode("merge")}>Fusionner avec une autre fiche</Button>
        )}

        {mode === "delete" ? (
          <div className="space-y-2 rounded-lg border border-danger/30 bg-danger-soft p-3">
            <p className="text-sm text-danger">Supprimer définitivement {name}, son dossier et tous ses rendez-vous ?</p>
            {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setMode(null)} disabled={pending}>Non</Button>
              <Button size="sm" variant="danger" loading={pending} onClick={() => start(async () => { setError(null); await deleteCustomerAndLeave(customerId); })}>Oui, supprimer</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="w-full text-danger hover:text-danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setMode("delete")}>Supprimer la fiche</Button>
        )}
      </div>
    </Card>
  );
}

function useCustomerSearch(excludeId?: string) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchCustomers>>>([]);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const t = setTimeout(async () => setResults(await searchCustomers(query, excludeId)), 200);
    return () => clearTimeout(t);
  }, [query, excludeId]);
  return { query, setQuery, results: query.trim().length < 2 ? [] : results };
}

function MergePicker({ customerId, name, term, onCancel }: { customerId: string; name: string; term: string; onCancel: () => void }) {
  const { query, setQuery, results } = useCustomerSearch(customerId);
  const [picked, setPicked] = useState<(typeof results)[number] | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm">Choisissez la fiche en double : ses rendez-vous et ses notes passeront sur la fiche de <strong>{name}</strong>, puis elle sera supprimée.</p>
      {picked ? (
        <div className="rounded-lg border border-accent bg-accent-soft px-3 py-2 text-sm">
          <p className="font-medium">{picked.name}</p>
          <p className="text-muted">{[picked.email, picked.phone].filter(Boolean).join(" · ")}</p>
        </div>
      ) : (
        <>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Rechercher un ${term}…`} aria-label="Rechercher la fiche à fusionner" autoFocus />
          {results.length ? (
            <ul className="max-h-48 overflow-auto rounded-lg border border-border">
              {results.map((r) => (
                <li key={r.id}><button type="button" onClick={() => setPicked(r)} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted"><span className="font-medium">{r.name}</span> <span className="text-muted">{[r.email, r.phone].filter(Boolean).join(" · ")}</span></button></li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Annuler</Button>
        <Button size="sm" disabled={!picked} loading={pending} onClick={() => start(async () => { const r = await mergeCustomers(customerId, picked!.id); if (r.ok) onCancel(); else setError(r.error ?? "Erreur."); })}>Fusionner</Button>
      </div>
    </div>
  );
}

/** Rattacher un rendez-vous à une autre fiche (depuis l'onglet Rendez-vous). */
export function ReassignButton({ appointmentId, customerId, term }: { appointmentId: string; customerId: string; term: string }) {
  const [open, setOpen] = useState(false);
  const { query, setQuery, results } = useCustomerSearch(customerId);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-text">
        <Link2 className="size-3.5" aria-hidden="true" />
        Rattacher à un autre {term}
      </button>
    );
  return (
    <div className="mt-2 w-full space-y-2 sm:w-72">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, email, téléphone…" aria-label={`Rechercher un ${term}`} autoFocus />
      {results.length ? (
        <ul className="rounded-lg border border-border">
          {results.map((r) => (
            <li key={r.id}><button type="button" disabled={pending} onClick={() => start(async () => { await reassignAppointment(appointmentId, r.id); setOpen(false); })} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted">{r.name} <span className="text-muted">{r.email ?? r.phone ?? ""}</span></button></li>
          ))}
        </ul>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
    </div>
  );
}

/** Ajouter une fiche à la main. */
export function NewCustomerForm({ term, initialOpen = false }: { term: string; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const [state, action, pending] = useActionState<CustomerState, FormData>(createCustomer, undefined);
  const err = state?.fieldErrors ?? {};
  if (!open) return null;
  return (
    <Card className="mb-4 w-full p-5">
      <form onSubmit={submitKeepingValues(action)} className="space-y-4" noValidate>
        <div>
          <h2 className="font-semibold">Ajouter un {term}</h2>
          <p className="text-sm text-muted">Le nom suffit. L&apos;email ou le téléphone rattacheront automatiquement ses futurs rendez-vous à cette fiche.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Prénom" htmlFor="n-first" error={err.firstName}><Input id="n-first" name="firstName" autoFocus aria-invalid={!!err.firstName || undefined} /></Field>
          <Field label="Nom" htmlFor="n-last"><Input id="n-last" name="lastName" /></Field>
          <Field label="Email (facultatif)" htmlFor="n-email" error={err.email}><Input id="n-email" name="email" type="email" aria-invalid={!!err.email || undefined} /></Field>
          <Field label="Téléphone (facultatif)" htmlFor="n-phone"><Input id="n-phone" name="phone" type="tel" /></Field>
        </div>
        {state?.error && !Object.keys(err).length ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => { setOpen(false); if (initialOpen) window.history.replaceState(null, "", "/app/clients"); }} disabled={pending}>Annuler</Button>
          <Button type="submit" loading={pending}>Ajouter</Button>
        </div>
      </form>
    </Card>
  );
}

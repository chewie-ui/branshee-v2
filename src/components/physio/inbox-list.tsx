"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCheck, FileText, Inbox, Search, Upload, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { searchCustomers } from "@/server/actions/customers";
import { createPatientFromInbox, integrateInboxItem, integrateMatchedInbox, rejectInboxItems, uploadToInbox } from "@/server/actions/care-inbox";

type Row = { id: string; title: string; source: string; sender: string; date: string | null; received: string; patient: string | null; canCreate: boolean; hasFile: boolean; excerpt: string; suggested: { id: string; name: string; byNiss: boolean } | null; conflicts: string[] };
type Handled = { id: string; title: string; status: string; patient: string | null; by: string; at: string };

function Item({ r, canManage, onDone }: { r: Row; canManage: boolean; onDone: (msg: { ok: boolean; text: string }) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(r.suggested);
  const [conflict, setConflict] = useState<string | null>(r.conflicts.length ? r.conflicts.join(" ; ") : null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok && res.error?.startsWith("Conflit")) setConflict(res.error);
      onDone(res.ok ? { ok: true, text: res.message ?? "" } : { ok: false, text: res.error ?? "Erreur." });
    });
  return (
    <li className="space-y-3 p-5">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">{r.title}<span className="ml-2 rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-muted">{r.source === "kmehr" ? "Kmehr" : "PDF"}</span></p>
          <p className="text-muted">{[r.sender && `De ${r.sender}`, r.date && `du ${r.date}`, `reçu le ${r.received}`].filter(Boolean).join(" · ")}</p>
          <p className="mt-1">{r.patient ? <>Patient indiqué : <span className="font-medium">{r.patient}</span></> : <span className="text-muted">Pas d&apos;identité patient dans le document : choisissez la fiche.</span>}</p>
          {r.excerpt ? <p className="mt-1 line-clamp-3 whitespace-pre-line text-muted">{r.excerpt}</p> : null}
          {r.hasFile ? <a href={`/app/clients/reception/${r.id}/fichier`} target="_blank" rel="noopener" className="mt-1 inline-block font-medium text-accent hover:text-accent-hover">Ouvrir le PDF</a> : null}
        </div>
      </div>
      {canManage ? (
        <div className="space-y-3 rounded-lg bg-surface-muted/60 p-4">
          <p className="text-sm">
            {chosen ? <>Dossier : <span className="font-medium">{chosen.name}</span>{r.suggested?.id === chosen.id ? <span className="text-muted"> ({r.suggested.byNiss ? "reconnu par le NISS" : "reconnu par nom et date de naissance"})</span> : null}</> : <span className="text-muted">Aucun patient reconnu.</span>}
          </p>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input
              value={q}
              aria-label="Choisir un autre patient"
              placeholder="Choisir un autre patient…"
              className="pl-9"
              onChange={(e) => {
                const v = e.target.value;
                setQ(v);
                if (v.trim().length < 2) return setResults([]);
                void searchCustomers(v).then((rows) => setResults(rows.map((x) => ({ id: x.id, name: x.name }))));
              }}
            />
            {results.length ? (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                {results.map((x) => <li key={x.id}><button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted" onClick={() => { setChosen(x); setConflict(null); setResults([]); setQ(""); }}>{x.name}</button></li>)}
              </ul>
            ) : null}
          </div>
          {conflict ? <p className="flex items-start gap-2 text-sm text-warning" role="alert"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{conflict.startsWith("Conflit") ? conflict : `Conflit d'identité : ${conflict}.`}</p> : null}
          <div className="flex flex-wrap gap-2">
            {chosen ? <Button size="sm" loading={pending} onClick={() => run(() => integrateInboxItem(r.id, chosen.id, false))}>Intégrer au dossier</Button> : null}
            {chosen && conflict ? <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => integrateInboxItem(r.id, chosen.id, true))}>Confirmer malgré le conflit</Button> : null}
            {r.canCreate ? <Button size="sm" variant="secondary" loading={pending} icon={<UserPlus className="size-4" aria-hidden="true" />} onClick={() => run(() => createPatientFromInbox(r.id))}>Créer la fiche du patient</Button> : null}
            <Button size="sm" variant="ghost" loading={pending} icon={<X className="size-4" aria-hidden="true" />} onClick={() => run(() => rejectInboxItems([r.id]))}>Écarter</Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Boîte de réception : dépôt de documents reçus, rapprochement du patient, intégration une par une ou en lot. */
export function InboxList({ items, handled, canManage }: { items: Row[]; handled: Handled[]; canManage: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const done = (m: { ok: boolean; text: string }) => {
    setMsg(m);
    router.refresh();
  };
  const sure = items.filter((r) => r.suggested?.byNiss && !r.conflicts.length).length;
  return (
    <div className="space-y-6">
      {canManage ? (
        <Card>
          <CardHeader title="Déposer des documents reçus" description="PDF ou messages Kmehr (XML), 10 Mo maximum par fichier. L'identité du patient d'un message Kmehr est lue automatiquement." />
          <form
            className="flex flex-wrap items-center gap-3 p-5 pt-0"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const form = e.currentTarget;
              start(async () => {
                const r = await uploadToInbox(fd);
                done(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
                if (r.ok) form.reset();
              });
            }}
          >
            <input type="file" name="files" multiple accept="application/pdf,.pdf,.xml,text/xml,application/xml" aria-label="Fichiers reçus" className="min-w-0 flex-1 text-sm file:mr-3 file:h-10 file:rounded-lg file:border file:border-border-strong file:bg-surface file:px-3 file:text-sm file:font-medium" />
            <Button type="submit" loading={pending} icon={<Upload className="size-4" aria-hidden="true" />}>Déposer</Button>
          </form>
        </Card>
      ) : null}
      {msg ? <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      <Card>
        <CardHeader title={`En attente (${items.length})`} action={canManage && sure > 1 ? <Button size="sm" variant="secondary" loading={pending} icon={<CheckCheck className="size-4" aria-hidden="true" />} onClick={() => start(async () => { const r = await integrateMatchedInbox(); done(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error }); })}>Intégrer les {sure} reconnus par NISS</Button> : null} />
        {items.length ? <ul className="divide-y divide-border">{items.map((r) => <Item key={r.id} r={r} canManage={canManage} onDone={done} />)}</ul> : <p className="flex items-center gap-2 px-5 pb-5 text-sm text-muted"><Inbox className="size-4" aria-hidden="true" />Rien en attente.</p>}
      </Card>
      {handled.length ? (
        <Card>
          <CardHeader title="Traités récemment" />
          <ul className="divide-y divide-border text-sm">
            {handled.map((h) => <li key={h.id} className="px-5 py-3"><span className="font-medium">{h.title}</span><span className="text-muted"> · {h.status === "integrated" ? `intégré au dossier de ${h.patient ?? "?"}` : "écarté"} · {h.by}, {h.at}</span></li>)}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

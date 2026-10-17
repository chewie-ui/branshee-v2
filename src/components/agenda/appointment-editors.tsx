"use client";

import { useState, useTransition } from "react";
import { BellRing, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { hhmmOf, minutesOf, parseQuickTime } from "@/lib/time-input";
import { rescheduleAppointment, restoreAppointment, savePayment, sendReminderNow } from "@/server/actions/appointments";

/** Modifier date, heure, durée et membre d'un RDV, avec un mot facultatif pour le client. */
export function RescheduleForm({ id, initial, members, hasEmail, clientTerm }: { id: string; initial: { date: string; start: string; durationMin: number; memberId: string }; members: { id: string; name: string }[]; hasEmail: boolean; clientTerm: string }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ ...initial, message: "", notify: true });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const startParsed = parseQuickTime(v.start);
  const moved = v.date !== initial.date || startParsed !== initial.start;

  if (!open)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => { setOpen(true); setDone(false); }}>
          Modifier le rendez-vous
        </Button>
        {done ? <span className="text-sm text-success" role="status">Rendez-vous modifié.</span> : null}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="r-date">
          <Input id="r-date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Heure" htmlFor="r-start" hint={startParsed ? `Fin à ${hhmmOf(Math.min(minutesOf(startParsed) + v.durationMin, 1439))}` : "Ex. 9 ou 14h30"}>
            <Input id="r-start" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} onBlur={() => startParsed && setV({ ...v, start: startParsed })} inputMode="numeric" />
          </Field>
          <Field label="Durée (min)" htmlFor="r-dur">
            <Input id="r-dur" type="number" min={5} max={720} step={5} value={v.durationMin} onChange={(e) => setV({ ...v, durationMin: Number(e.target.value) || 0 })} />
          </Field>
        </div>
      </div>
      {members.length > 1 ? (
        <Field label="Avec" htmlFor="r-member">
          <Select id="r-member" value={v.memberId} onChange={(e) => setV({ ...v, memberId: e.target.value })}>
            <option value="">Non assigné</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </Field>
      ) : null}
      {moved && hasEmail ? (
        <>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={v.notify} onChange={(e) => setV({ ...v, notify: e.target.checked })} className="size-4 accent-[var(--accent)]" />
            Prévenir le {clientTerm} par email du nouveau créneau
          </label>
          {v.notify ? (
            <Field label={`Mot au ${clientTerm} (facultatif)`} htmlFor="r-msg" hint="Inclus dans l'email qui annonce le nouveau créneau.">
              <Textarea id="r-msg" rows={2} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} maxLength={500} placeholder="Ex. désolée, j'ai un imprévu, je vous propose ce créneau à la place." />
            </Field>
          ) : null}
        </>
      ) : null}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Annuler</Button>
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await rescheduleAppointment(id, { date: v.date, start: v.start, durationMin: v.durationMin, memberId: v.memberId, message: v.message, notify: v.notify });
              if (r.ok) { setOpen(false); setDone(true); } else setError(r.error);
            })
          }
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

export function ReminderButton({ id, sentAt }: { id: string; sentAt: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(sentAt ? { ok: true, text: `Dernier rappel manuel : ${sentAt}` } : null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" icon={<BellRing className="size-4" aria-hidden="true" />} loading={pending} onClick={() => start(async () => { const r = await sendReminderNow(id); setMsg(r.ok ? { ok: true, text: "Rappel envoyé." } : { ok: false, text: r.error ?? "Erreur." }); })}>
        Envoyer un rappel
      </Button>
      {msg ? <span className={msg.ok ? "text-sm text-muted" : "text-sm text-danger"} role="status">{msg.text}</span> : null}
    </div>
  );
}

export function RestoreButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Button variant="secondary" icon={<RotateCcw className="size-4" aria-hidden="true" />} loading={pending} onClick={() => start(async () => { const r = await restoreAppointment(id); if (!r.ok) setError(r.error ?? "Erreur."); })}>
        Restaurer le rendez-vous
      </Button>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    </div>
  );
}

const METHODS = [["none", "Non défini"], ["on_site", "Sur place (carte)"], ["cash", "Espèces"], ["bank_transfer", "Virement"], ["paypal", "PayPal"], ["online", "En ligne"]] as const;
const STATUSES = [["none", "Non payé"], ["paid", "Payé"], ["partial", "Payé en partie"], ["refunded", "Remboursé"]] as const;

export function PaymentForm({ id, initial }: { id: string; initial: { method: string; status: string; amount: string } }) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Mode" htmlFor="p-method">
          <Select id="p-method" value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>
            {METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Statut" htmlFor="p-status">
          <Select id="p-status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
            {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            {!STATUSES.some(([k]) => k === v.status) ? <option value={v.status}>{v.status}</option> : null}
          </Select>
        </Field>
        <Field label="Montant (€)" htmlFor="p-amount">
          <Input id="p-amount" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="45" />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        {msg ? <span className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role="status">{msg.text}</span> : null}
        <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => { const r = await savePayment(id, v as never); setMsg(r.ok ? { ok: true, text: "Paiement enregistré." } : { ok: false, text: r.error ?? "Erreur." }); })}>
          Enregistrer le paiement
        </Button>
      </div>
    </div>
  );
}

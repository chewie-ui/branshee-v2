"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { saveNotifications } from "@/server/actions/settings";
import { Section, SettingsForm, Toggle } from "./settings-form";

type N = {
  reminderDelayHours: number;
  confirmationMessage: string;
  reminderMessage: string;
  cancellationMessage: string;
  emailOwnerOnNewBooking: boolean;
  emailOwnerOnCancellation: boolean;
  reminderPaymentMethods: string[];
  reminderPaymentNote: string;
};

const METHODS = [
  { v: "carte", l: "Carte bancaire" },
  { v: "especes", l: "Espèces" },
  { v: "qr_code", l: "QR code (Payconiq…)" },
  { v: "virement", l: "Virement" },
];

/** Rappel : délai, message, modes de paiement — avec l'aperçu de ce que reçoit le client. */
function ReminderFields({ n }: { n: N }) {
  const [delay, setDelay] = useState(String(n.reminderDelayHours));
  const [message, setMessage] = useState(n.reminderMessage);
  const [methods, setMethods] = useState(n.reminderPaymentMethods);
  const [note, setNote] = useState(n.reminderPaymentNote);
  const pay = [METHODS.filter((m) => methods.includes(m.v)).map((m) => m.l).join(", "), note.trim()].filter(Boolean).join(" — ");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <Field label="Rappel avant le rendez-vous" htmlFor="reminderDelayHours">
          <Select id="reminderDelayHours" name="reminderDelayHours" value={delay} onChange={(e) => setDelay(e.target.value)} className="sm:max-w-xs">
            <option value="0">Pas de rappel</option>
            {[6, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} heures avant</option>)}
          </Select>
        </Field>
        <Field label="Message ajouté au rappel (facultatif)" htmlFor="reminderMessage">
          <Textarea id="reminderMessage" name="reminderMessage" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={500} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Modes de paiement rappelés</legend>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => {
              const on = methods.includes(m.v);
              return (
                <label key={m.v} className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium", on ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border text-muted hover:text-text")}>
                  <input type="checkbox" name="reminderPaymentMethods" value={m.v} checked={on} onChange={() => setMethods((l) => (on ? l.filter((x) => x !== m.v) : [...l, m.v]))} className="sr-only" />
                  {m.l}
                </label>
              );
            })}
          </div>
        </fieldset>
        <Field label="Précisions sur le paiement (facultatif)" htmlFor="reminderPaymentNote" hint="Ex. « Pas de carte American Express. »">
          <Input id="reminderPaymentNote" name="reminderPaymentNote" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
      </div>

      <div aria-label="Aperçu de l'email de rappel" className="h-fit rounded-xl border border-border bg-surface-muted p-4 text-sm">
        <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Aperçu de l&apos;email</p>
        {delay === "0" ? (
          <p className="text-muted">Aucun rappel ne sera envoyé.</p>
        ) : (
          <div className="space-y-3 rounded-lg bg-surface p-4 shadow-sm">
            <p className="flex items-center gap-2 font-semibold"><Bell className="size-4 text-accent" aria-hidden="true" />Rappel de votre rendez-vous</p>
            <p className="text-muted">Envoyé {delay} h avant le rendez-vous, avec la date, la prestation et l&apos;adresse.</p>
            {pay ? (
              <p>
                <span className="block text-xs text-muted">Paiement sur place</span>
                <span className="font-medium">{pay}</span>
              </p>
            ) : null}
            <p className="text-xs text-muted">{message.trim() || "Un empêchement ? Merci d'annuler dès que possible pour libérer le créneau."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function NotificationsForm({ n }: { n: N }) {
  return (
    <SettingsForm action={saveNotifications}>
      {() => (
        <>
          <Section title="Rappel automatique" description="Envoyé par email au client avant chaque rendez-vous.">
            <ReminderFields n={n} />
          </Section>
          <Section title="Autres emails à vos clients" description="Envoyés automatiquement à chaque étape du rendez-vous.">
            <Field label="Message ajouté à la confirmation (facultatif)" htmlFor="confirmationMessage" hint="Ex. : « Pensez à apporter votre prescription et une serviette. »">
              <Textarea id="confirmationMessage" name="confirmationMessage" defaultValue={n.confirmationMessage} rows={2} maxLength={500} />
            </Field>
            <Field label="Message ajouté à l'annulation (facultatif)" htmlFor="cancellationMessage">
              <Textarea id="cancellationMessage" name="cancellationMessage" defaultValue={n.cancellationMessage} rows={2} maxLength={500} />
            </Field>
          </Section>
          <Section title="Emails que vous recevez" description="Envoyés au propriétaire et au praticien concerné.">
            <Toggle name="emailOwnerOnNewBooking" defaultChecked={n.emailOwnerOnNewBooking} label="Nouvelle réservation en ligne" />
            <Toggle name="emailOwnerOnCancellation" defaultChecked={n.emailOwnerOnCancellation} label="Annulation par un client" />
          </Section>
        </>
      )}
    </SettingsForm>
  );
}

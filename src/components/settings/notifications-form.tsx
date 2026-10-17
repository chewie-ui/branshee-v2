"use client";

import { Field, Select, Textarea } from "@/components/ui/field";
import { saveNotifications } from "@/server/actions/settings";
import { Section, SettingsForm, Toggle } from "./settings-form";

type N = { reminderDelayHours: number; confirmationMessage: string; reminderMessage: string; cancellationMessage: string; emailOwnerOnNewBooking: boolean; emailOwnerOnCancellation: boolean };

export function NotificationsForm({ n }: { n: N }) {
  return (
    <SettingsForm action={saveNotifications}>
      {() => (
        <>
          <Section title="Emails à vos clients" description="Envoyés automatiquement à chaque étape du rendez-vous.">
            <Field label="Rappel avant le rendez-vous" htmlFor="reminderDelayHours">
              <Select id="reminderDelayHours" name="reminderDelayHours" defaultValue={String(n.reminderDelayHours)} className="sm:max-w-xs">
                <option value="0">Pas de rappel</option>
                {[6, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} heures avant</option>)}
              </Select>
            </Field>
            <Field label="Message ajouté à la confirmation (facultatif)" htmlFor="confirmationMessage" hint="Ex. : « Pensez à apporter votre prescription et une serviette. »">
              <Textarea id="confirmationMessage" name="confirmationMessage" defaultValue={n.confirmationMessage} rows={2} maxLength={500} />
            </Field>
            <Field label="Message ajouté au rappel (facultatif)" htmlFor="reminderMessage">
              <Textarea id="reminderMessage" name="reminderMessage" defaultValue={n.reminderMessage} rows={2} maxLength={500} />
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

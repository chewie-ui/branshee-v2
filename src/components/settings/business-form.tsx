"use client";

import { Field, Input, Textarea } from "@/components/ui/field";
import { saveBusinessInfo } from "@/server/actions/settings";
import { Section, SettingsForm } from "./settings-form";

type B = { name: string; businessType: string; description: string; email: string; phone: string };

export function BusinessForm({ b }: { b: B }) {
  return (
    <SettingsForm action={saveBusinessInfo}>
      {(err) => (
        <>
          <Section title="Identité" description="Ce que vos clients voient en haut de votre page.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de l'établissement" htmlFor="name" error={err.name}>
                <Input id="name" name="name" defaultValue={b.name} maxLength={80} aria-invalid={!!err.name || undefined} />
              </Field>
              <Field label="Métier" htmlFor="businessType" error={err.businessType}>
                <Input id="businessType" name="businessType" defaultValue={b.businessType} maxLength={60} />
              </Field>
            </div>
            <Field label="Présentation" htmlFor="description" hint="Deux ou trois phrases : utilisées dans l'annuaire et dans les résultats Google. Le texte détaillé « À propos » se rédige dans Page de réservation.">
              <Textarea id="description" name="description" defaultValue={b.description} rows={3} maxLength={1000} />
            </Field>
          </Section>

          <Section title="Coordonnées" description="Affichées sur votre page et dans les emails envoyés aux clients. L'adresse, les réseaux sociaux et le lien de votre page se règlent dans « Page de réservation ».">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email de contact" htmlFor="email" error={err.email} hint="Les réponses des clients aux emails arrivent ici.">
                <Input id="email" name="email" type="email" defaultValue={b.email} aria-invalid={!!err.email || undefined} />
              </Field>
              <Field label="Téléphone" htmlFor="phone" error={err.phone}>
                <Input id="phone" name="phone" type="tel" defaultValue={b.phone} />
              </Field>
            </div>
          </Section>
        </>
      )}
    </SettingsForm>
  );
}

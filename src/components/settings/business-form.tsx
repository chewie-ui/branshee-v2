"use client";

import { Field, Input, Textarea } from "@/components/ui/field";
import { saveBusinessInfo } from "@/server/actions/settings";
import { Section, SettingsForm } from "./settings-form";
import { useT } from "@/components/app-locale";

type B = { name: string; businessType: string; description: string; email: string; phone: string };

export function BusinessForm({ b }: { b: B }) {
  const t = useT();
  return (
    <SettingsForm action={saveBusinessInfo}>
      {(err) => (
        <>
          <Section title={t("Identité")} description={t("Ce que vos clients voient en haut de votre page.")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("Nom de l'établissement")} htmlFor="name" error={err.name}>
                <Input id="name" name="name" defaultValue={b.name} maxLength={80} aria-invalid={!!err.name || undefined} />
              </Field>
              <Field label={t("Métier")} htmlFor="businessType" error={err.businessType}>
                <Input id="businessType" name="businessType" defaultValue={b.businessType} maxLength={60} />
              </Field>
            </div>
            <Field label={t("Présentation")} htmlFor="description" hint={t("Deux ou trois phrases : utilisées dans l'annuaire et dans les résultats Google. Le texte détaillé « À propos » se rédige dans Page de réservation.")}>
              <Textarea id="description" name="description" defaultValue={b.description} rows={3} maxLength={1000} />
            </Field>
          </Section>

          <Section title={t("Coordonnées")} description={t("Affichées sur votre page et dans les emails envoyés aux clients. L'adresse, les réseaux sociaux et le lien de votre page se règlent dans « Page de réservation ».")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("Email de contact")} htmlFor="email" error={err.email} hint={t("Les réponses des clients aux emails arrivent ici.")}>
                <Input id="email" name="email" type="email" defaultValue={b.email} aria-invalid={!!err.email || undefined} />
              </Field>
              <Field label={t("Téléphone")} htmlFor="phone" error={err.phone}>
                <Input id="phone" name="phone" type="tel" defaultValue={b.phone} className="data-[missing]:border-warning data-[missing]:bg-warning-soft data-[missing]:ring-4 data-[missing]:ring-warning/25" />
              </Field>
            </div>
          </Section>
        </>
      )}
    </SettingsForm>
  );
}

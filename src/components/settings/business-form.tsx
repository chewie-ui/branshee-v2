"use client";

import { Field, Input, Textarea } from "@/components/ui/field";
import { saveBusinessInfo } from "@/server/actions/settings";
import { Section, SettingsForm } from "./settings-form";

type B = { name: string; businessType: string; description: string; email: string; phone: string; website: string; address: string; postalCode: string; city: string; slug: string };

export function BusinessForm({ b, appUrl }: { b: B; appUrl: string }) {
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
            <Field label="Présentation" htmlFor="description" hint="Quelques lignes affichées dans « À propos ».">
              <Textarea id="description" name="description" defaultValue={b.description} rows={4} maxLength={1000} />
            </Field>
          </Section>

          <Section title="Lien de réservation">
            <Field label="Adresse de votre page" htmlFor="slug" error={err.slug} hint="Changer cette adresse rend l'ancien lien inactif.">
              <div className="flex items-stretch overflow-hidden rounded-lg border border-border-strong focus-within:border-accent">
                <span className="hidden items-center bg-surface-muted px-3 text-sm text-muted sm:flex">{appUrl.replace(/^https?:\/\//, "")}/</span>
                <input id="slug" name="slug" defaultValue={b.slug} maxLength={60} className="h-10 min-w-0 flex-1 bg-surface px-3 text-sm focus-visible:outline-none" aria-invalid={!!err.slug || undefined} />
              </div>
            </Field>
          </Section>

          <Section title="Coordonnées" description="Affichées sur votre page et dans les emails envoyés aux clients.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email de contact" htmlFor="email" error={err.email} hint="Les réponses des clients aux emails arrivent ici.">
                <Input id="email" name="email" type="email" defaultValue={b.email} aria-invalid={!!err.email || undefined} />
              </Field>
              <Field label="Téléphone" htmlFor="phone" error={err.phone}>
                <Input id="phone" name="phone" type="tel" defaultValue={b.phone} />
              </Field>
              <Field label="Site web" htmlFor="website" error={err.website} className="sm:col-span-2">
                <Input id="website" name="website" type="url" defaultValue={b.website} placeholder="https://" aria-invalid={!!err.website || undefined} />
              </Field>
              <Field label="Adresse" htmlFor="address" className="sm:col-span-2">
                <Input id="address" name="address" defaultValue={b.address} autoComplete="street-address" />
              </Field>
              <Field label="Code postal" htmlFor="postalCode">
                <Input id="postalCode" name="postalCode" defaultValue={b.postalCode} autoComplete="postal-code" />
              </Field>
              <Field label="Ville" htmlFor="city">
                <Input id="city" name="city" defaultValue={b.city} autoComplete="address-level2" />
              </Field>
            </div>
          </Section>
        </>
      )}
    </SettingsForm>
  );
}

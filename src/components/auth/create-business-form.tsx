"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createBusinessAction, type CreateBusinessState } from "@/server/actions/business";
import { submitKeepingValues } from "@/lib/form";

export function CreateBusinessForm() {
  const [state, action, pending] = useActionState<CreateBusinessState, FormData>(createBusinessAction, undefined);
  const err = state?.fieldErrors ?? {};
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4" noValidate>
      <Field label="Nom de l'établissement" htmlFor="name" error={err.name} hint="Tel que vos clients le connaissent.">
        <Input id="name" name="name" required defaultValue={state?.values?.name} aria-invalid={!!err.name || undefined} />
      </Field>
      <Field label="Métier" htmlFor="businessType" error={err.businessType}>
        <Input id="businessType" name="businessType" placeholder="Kinésithérapie, coiffure, ostéopathie…" defaultValue={state?.values?.businessType} />
      </Field>
      <Field label="Ville" htmlFor="city" error={err.city}>
        <Input id="city" name="city" autoComplete="address-level2" defaultValue={state?.values?.city} />
      </Field>
      <Button type="submit" loading={pending} className="w-full">
        Créer mon établissement
      </Button>
    </form>
  );
}

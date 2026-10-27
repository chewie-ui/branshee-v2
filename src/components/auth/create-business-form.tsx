"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createBusinessAction, type CreateBusinessState } from "@/server/actions/business";
import { submitKeepingValues } from "@/lib/form";
import { cn } from "@/lib/cn";

const STEPS = ["Votre établissement", "Votre métier", "Où exercez-vous ?"];
/** Skydev : pour toutes les entreprises, pas seulement les indépendants sur rendez-vous. */
const COMPANY_STEPS = ["Votre entreprise", "Votre activité", "Où êtes-vous situé ?"];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Création de l'établissement en trois étapes courtes : nom, métier (liste officielle ou demande d'ajout), ville. */
export function CreateBusinessForm({ professions, company = false }: { professions: string[]; company?: boolean }) {
  const steps = company ? COMPANY_STEPS : STEPS;
  const [state, action, pending] = useActionState<CreateBusinessState, FormData>(createBusinessAction, undefined);
  const err = state?.fieldErrors ?? {};
  const [step, setStep] = useState(err.name ? 0 : err.businessType ? 1 : state ? 2 : 0);
  const [name, setName] = useState(state?.values?.name ?? "");
  const [type, setType] = useState(state?.values?.businessType ?? "");
  const [stepError, setStepError] = useState<string | null>(null);
  const known = !type.trim() || professions.some((p) => norm(p) === norm(type));
  const suggestions = type.trim().length >= 2 ? professions.filter((p) => norm(p).includes(norm(type))).slice(0, company ? 8 : 6) : [];

  const next = () => {
    if (step === 0 && name.trim().length < 2) return setStepError(company ? "Indiquez le nom de votre entreprise." : "Indiquez le nom de votre établissement.");
    setStepError(null);
    setStep((s) => Math.min(2, s + 1));
  };

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-5" noValidate>
      <ol className="flex items-center gap-2" aria-label="Étapes">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", i < step ? "bg-success text-white" : i === step ? "bg-accent text-accent-foreground" : "bg-surface-muted text-muted")}>
              {i < step ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
            </span>
            {i < steps.length - 1 ? <span className={cn("h-px flex-1", i < step ? "bg-success" : "bg-border")} aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
      <p className="text-sm font-semibold">{steps[step]}</p>
      {state?.error ? <p className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm text-warning" role="alert">{state.error}</p> : null}

      <div hidden={step !== 0}>
        <Field label={company ? "Nom de l'entreprise" : "Nom de l'établissement"} htmlFor="name" error={err.name ?? (step === 0 ? stepError ?? undefined : undefined)} hint={company ? "Votre société, commerce, cabinet ou association, tel que vos clients le connaissent." : "Tel que vos clients le connaissent."}>
          <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), next())} maxLength={80} aria-invalid={!!err.name || undefined} />
        </Field>
      </div>

      <div hidden={step !== 1} className="space-y-2">
        <Field label={company ? "Activité" : "Métier"} htmlFor="businessType" error={err.businessType} hint={company ? "Choisissez dans la liste, ou écrivez la vôtre." : "Choisissez dans la liste, ou écrivez le vôtre."}>
          <Input id="businessType" name="businessType" value={type} onChange={(e) => setType(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), next())} placeholder={company ? "Kiné, coiffeur, plombier, restaurant, agence web…" : "Kinésithérapeute, coiffeur, ostéopathe…"} maxLength={60} autoComplete="off" />
        </Field>
        {suggestions.length && !known ? (
          <ul className="flex flex-wrap gap-2" aria-label="Suggestions">
            {suggestions.map((s) => (
              <li key={s}><button type="button" onClick={() => setType(s)} className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent">{s}</button></li>
            ))}
          </ul>
        ) : null}
        {!known && type.trim().length >= 2 ? <p className="text-sm text-muted">{company ? "Cette activité n'est pas encore dans notre liste : nous l'ajouterons après vérification. Vous pouvez continuer." : "Ce métier n'est pas encore dans notre liste : nous l'ajouterons après vérification. Vous pouvez continuer."}</p> : null}
      </div>

      <div hidden={step !== 2}>
        <Field label="Ville" htmlFor="city" error={err.city}>
          <Input id="city" name="city" autoComplete="address-level2" defaultValue={state?.values?.city} maxLength={80} />
        </Field>
      </div>

      <div className="flex gap-2">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)} icon={<ArrowLeft className="size-4" aria-hidden="true" />}>Retour</Button>
        ) : null}
        {step < 2 ? (
          <Button key="next" type="button" className="flex-1" onClick={next}>
            Continuer
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button key="submit" type="submit" loading={pending} className="flex-1">{company ? "Créer mon espace" : "Créer mon établissement"}</Button>
        )}
      </div>
    </form>
  );
}

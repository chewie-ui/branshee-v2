"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { NEEDS, TEAM_SIZES, type NeedId, type TeamSize } from "@/lib/apps";
import { saveAppSetup } from "@/server/actions/apps";

/**
 * Questionnaire de départ Skydev (2 questions) : taille de l'équipe et besoins.
 * Les apps utiles vont sur l'accueil, les autres restent disponibles dans « Ajouter des apps ».
 */
export function AppSetup({ firstName, initial }: { firstName: string; initial?: { teamSize?: string; needs?: string[] } }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [size, setSize] = useState<TeamSize | null>((initial?.teamSize as TeamSize) ?? null);
  const [needs, setNeeds] = useState<NeedId[]>((initial?.needs as NeedId[]) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (id: NeedId) => setNeeds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const finish = () =>
    start(async () => {
      setError(null);
      const r = await saveAppSetup({ teamSize: size ?? "solo", needs });
      if (!r.ok) return setError(r.error);
      router.push("/app?pret=1");
      router.refresh();
    });

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm font-medium text-accent">Question {step + 1} sur 2</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{step === 0 ? `Bienvenue ${firstName} ! Vous travaillez…` : "Qu'est-ce que Skydev doit faire pour vous ?"}</h1>
      <p className="mt-1 text-sm text-muted">{step === 0 ? "On prépare votre accueil avec les bonnes apps. Vous pourrez tout changer ensuite." : "Cochez tout ce qui vous intéresse. Les autres apps restent disponibles à tout moment."}</p>

      {step === 0 ? (
        <div role="radiogroup" aria-label="Taille de l'équipe" className="mt-6 grid gap-3 sm:grid-cols-3">
          {TEAM_SIZES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={size === t.value}
              onClick={() => setSize(t.value)}
              className={cn("flex min-h-24 flex-col items-start justify-center rounded-xl border bg-surface p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", size === t.value ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong")}
            >
              <span className="font-semibold">{t.label}</span>
              <span className="text-sm text-muted">{t.hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {NEEDS.map((n) => {
            const on = needs.includes(n.id);
            return (
              <button
                key={n.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(n.id)}
                className={cn("flex items-start gap-3 rounded-xl border bg-surface p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", on ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong")}
              >
                <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border", on ? "border-accent bg-accent text-accent-foreground" : "border-border-strong")} aria-hidden="true">
                  {on ? <Check className="size-3.5" /> : null}
                </span>
                <span>
                  <span className="block font-medium">{n.label}</span>
                  <span className="block text-sm text-muted">{n.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-danger" role="alert">{error}</p> : null}

      <Card className="mt-6 flex flex-col-reverse gap-3 p-4 sm:flex-row sm:items-center">
        {step === 1 ? (
          <Button variant="secondary" icon={<ArrowLeft className="size-4" aria-hidden="true" />} onClick={() => setStep(0)} disabled={pending}>Retour</Button>
        ) : null}
        <p className="flex-1 text-sm text-muted">{step === 1 ? (needs.length ? `${needs.length} besoin${needs.length > 1 ? "s" : ""} choisi${needs.length > 1 ? "s" : ""}` : "Rien de coché : toutes les apps resteront disponibles.") : "Toutes les apps restent incluses dans votre abonnement."}</p>
        {step === 0 ? (
          <Button onClick={() => setStep(1)} disabled={!size}>Continuer <ArrowRight className="size-4" aria-hidden="true" /></Button>
        ) : (
          <Button onClick={finish} loading={pending}>Préparer mon espace</Button>
        )}
      </Card>
    </div>
  );
}

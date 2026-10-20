"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { ADDONS, LIMITS, PLANS, type Plan } from "@/lib/plans";

/** Contenu des forfaits : dérivé des limites réelles (lib/plans), pour ne jamais promettre autre chose que l'application. */
const ITEMS: Record<Plan, string[]> = {
  free: [
    "Rendez-vous illimités, 0 % de commission",
    `Jusqu'à ${LIMITS.services.free} prestations actives`,
    `Confirmation automatique jusqu'à ${LIMITS.autoConfirmUpTo.free} réservations en ligne par mois, ensuite à confirmer`,
    "Page de réservation 24 h/24, sans compte client",
    "Agenda, fiches et dossiers clients",
    "Paiement en ligne et politique d'annulation (Stripe)",
    `${LIMITS.formQuestions.free} question avant la réservation`,
  ],
  pro: [
    "Tout le forfait Amateur, sans limite de prestations",
    "Toutes les réservations confirmées automatiquement",
    `Rappels automatiques par email, ${LIMITS.smsIncluded.pro} SMS ou WhatsApp inclus par mois`,
    "Page personnalisée : couleurs, polices, galerie, réseaux sociaux",
    "Synchronisation Google Agenda",
    `${LIMITS.collaborators.pro} collaborateurs inclus (${ADDONS.seat.monthly} €/mois le siège en plus)`,
    `${LIMITS.formQuestions.pro} questions avant la réservation`,
    "Temps de battement, durée des créneaux, historique complet",
  ],
  pro_plus: [
    "Tout le forfait Pro",
    `${LIMITS.collaborators.pro_plus} collaborateurs inclus, grades et permissions sur mesure`,
    "Journal d'activité de l'équipe",
    "Mon site : un site vitrine publié en un clic",
    "Adresse personnalisée et emails sans mention Branshee",
    `${LIMITS.smsIncluded.pro_plus} SMS ou WhatsApp inclus par mois · ${LIMITS.formQuestions.pro_plus} questions`,
    "Un établissement gratuit de plus",
  ],
};

export function PricingTable({ signupHref = "/inscription" }: { signupHref?: string }) {
  const [yearly, setYearly] = useState(false);
  const plans: Plan[] = ["free", "pro", "pro_plus"];
  return (
    <div>
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-surface p-1" role="group" aria-label="Période de facturation">
          {[false, true].map((y) => (
            <button key={String(y)} type="button" onClick={() => setYearly(y)} aria-pressed={yearly === y} className={cn("rounded-full px-4 py-2 text-sm font-medium transition-colors", yearly === y ? "bg-accent text-accent-foreground" : "text-muted hover:text-text")}>
              {y ? "Annuel (-20 %)" : "Mensuel"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {plans.map((p) => {
          const price = yearly ? PLANS[p].yearlyPerMonth : PLANS[p].monthly;
          const popular = p === "pro";
          return (
            <div key={p} className={cn("relative flex flex-col rounded-2xl border bg-surface p-6", popular ? "border-accent shadow-lg ring-1 ring-accent" : "border-border")}>
              {popular ? <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">Le plus choisi</span> : null}
              <h3 className="text-lg font-semibold">{PLANS[p].label}</h3>
              <p className="mt-1 text-sm text-muted">{PLANS[p].tagline}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">{price} €</span>
                <span className="text-sm text-muted">/ mois</span>
              </p>
              <p className="mt-1 h-5 text-xs text-muted">{p === "free" ? "Pour toujours, sans carte bancaire" : yearly ? `Facturé ${PLANS[p].yearlyPerMonth * 12} € par an` : `ou ${PLANS[p].yearlyPerMonth} €/mois à l'année`}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {ITEMS[p].map((i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
              <Link href={signupHref} className={cn("mt-8 inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors", popular ? "bg-accent text-accent-foreground hover:bg-accent-hover" : "border border-border-strong hover:bg-surface-muted")}>
                {p === "free" ? "Commencer gratuitement" : `Choisir ${PLANS[p].label}`}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm text-muted">Paiement sécurisé par Stripe · Sans engagement · 0 % de commission · Le forfait se choisit par établissement, après l&apos;inscription.</p>
    </div>
  );
}

import { CalendarOff, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { EffectivePlan } from "@/server/plan";

/** Jours restants, arrondis au jour supérieur (minimum 1 : « dernier jour »). */
function daysUntil(d: Date) {
  return Math.max(1, Math.ceil((d.getTime() - new Date().getTime()) / 86400_000));
}

/**
 * Bandeau d'abonnement en haut de l'espace pro : jours d'essai restants, ou réservation fermée
 * faute d'abonnement. Rien n'est affiché pour un établissement abonné.
 */
export function PlanBanner({ plan, canManage, timezone }: { plan: EffectivePlan; canManage: boolean; timezone: string }) {
  if (plan.plan === "free") {
    return (
      <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 sm:flex-row sm:items-center">
        <CalendarOff className="size-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-danger">Réservation en ligne fermée</p>
          <p className="text-text">Votre établissement n&apos;a pas d&apos;abonnement actif : vos clients ne peuvent plus réserver en ligne. Vos rendez-vous et votre fichier restent consultables.</p>
        </div>
        {canManage ? <ButtonLink href="/app/reglages/abonnement" size="sm">S&apos;abonner</ButtonLink> : null}
      </div>
    );
  }
  if (plan.source !== "granted" || !plan.isTrial || !plan.grantedUntil) return null;
  const days = daysUntil(plan.grantedUntil);
  const soon = days <= 7;
  const until = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", timeZone: timezone }).format(plan.grantedUntil);
  return (
    <div className={cn("mb-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center", soon ? "border-warning/30 bg-warning-soft" : "border-accent/30 bg-accent-soft")}>
      <Sparkles className={cn("size-5 shrink-0", soon ? "text-warning" : "text-accent")} aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className={cn("font-medium", soon ? "text-warning" : "text-accent-soft-foreground")}>
          Essai gratuit du forfait Pro : {days === 1 ? "dernier jour" : `encore ${days} jours`}
        </p>
        <p className="text-text">Jusqu&apos;au {until}. Ensuite, la réservation en ligne se ferme si vous n&apos;êtes pas abonné.</p>
      </div>
      {canManage ? <ButtonLink href="/app/reglages/abonnement" size="sm" variant={soon ? "primary" : "secondary"}>Choisir mon forfait</ButtonLink> : null}
    </div>
  );
}

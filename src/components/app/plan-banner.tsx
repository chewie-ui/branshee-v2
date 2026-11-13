import { CalendarOff, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { EffectivePlan } from "@/server/plan";
import type { BrandId } from "@/lib/brand";
import { makeT, type AppLocale } from "@/lib/i18n/app";

/** Jours restants, arrondis au jour supérieur (minimum 1 : « dernier jour »). */
function daysUntil(d: Date) {
  return Math.max(1, Math.ceil((d.getTime() - new Date().getTime()) / 86400_000));
}

/**
 * Bandeau d'abonnement en haut de l'espace pro : jours d'essai restants, ou réservation fermée
 * faute d'abonnement. Rien n'est affiché pour un établissement abonné.
 */
export function PlanBanner({ plan, canManage, timezone, brand = "branshee", locale = "fr", noTrial = false, businessName = "" }: { plan: EffectivePlan; canManage: boolean; timezone: string; brand?: BrandId; locale?: AppLocale; /** Skydev : 2e entreprise du compte, l'essai gratuit a déjà servi pour une autre. */ noTrial?: boolean; businessName?: string }) {
  const sky = brand === "skydev";
  const t = makeT(sky ? locale : "fr");
  // Skydev, 2e entreprise : pas d'essai (il vaut pour une seule entreprise), un abonnement par entreprise.
  if (plan.plan === "free" && sky && noTrial) {
    return (
      <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 sm:flex-row sm:items-center">
        <CalendarOff className="size-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-warning">{t("« {name} » n'a pas encore d'abonnement", { name: businessName })}</p>
          <p className="text-text">{t("L'essai gratuit d'un mois vaut pour une seule entreprise, et il a déjà servi pour une autre de vos entreprises. Chaque entreprise a son propre abonnement (dès 29 € par mois, toutes les apps). En attendant, cet espace est en lecture seule.")}</p>
        </div>
        {canManage ? <ButtonLink href="/app/reglages/abonnement" size="sm">{t("Abonner cette entreprise")}</ButtonLink> : null}
      </div>
    );
  }
  if (plan.plan === "free") {
    return (
      <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 sm:flex-row sm:items-center">
        <CalendarOff className="size-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-danger">{sky ? t("Votre essai est terminé : espace en lecture seule") : "Réservation en ligne fermée"}</p>
          <p className="text-text">{sky ? t("Vos données sont conservées et restent consultables, mais plus rien ne peut être créé ni modifié, et vos pages publiques (réservation, boutique, commande à table) sont fermées. Abonnez cette entreprise pour tout rouvrir, en une minute (un abonnement par entreprise).") : <>Votre établissement n&apos;a pas d&apos;abonnement actif : vos clients ne peuvent plus réserver en ligne. Vos rendez-vous et votre fichier restent consultables.</>}</p>
        </div>
        {canManage ? <ButtonLink href="/app/reglages/abonnement" size="sm">{sky ? t("Choisir un abonnement") : <>S&apos;abonner</>}</ButtonLink> : null}
      </div>
    );
  }
  // Essai : seulement pour qui gère l'abonnement (un collaborateur n'a rien à faire de ce bandeau).
  if (!canManage || plan.source !== "granted" || !plan.isTrial || !plan.grantedUntil) return null;
  const days = daysUntil(plan.grantedUntil);
  const soon = days <= 7;
  const until = new Intl.DateTimeFormat(sky && locale === "en" ? "en-GB" : "fr-BE", { day: "numeric", month: "long", timeZone: timezone }).format(plan.grantedUntil);
  return (
    <div className={cn("mb-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center", soon ? "border-warning/30 bg-warning-soft" : "border-accent/30 bg-accent-soft")}>
      <Sparkles className={cn("size-5 shrink-0", soon ? "text-warning" : "text-accent")} aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className={cn("font-medium", soon ? "text-warning" : "text-accent-soft-foreground")}>
          {sky ? (days === 1 ? t("Essai gratuit de Skydev : dernier jour") : t("Essai gratuit de Skydev : encore {n} jours", { n: days })) : <>Essai gratuit du forfait Pro : {days === 1 ? "dernier jour" : `encore ${days} jours`}</>}
        </p>
        <p className="text-text">{sky ? t("Toutes les apps sont ouvertes pour cette entreprise jusqu'au {date}. Ensuite, abonnez-vous pour continuer (dès 29 € par mois, toutes les apps). Un abonnement par entreprise.", { date: until }) : <>Jusqu&apos;au {until}. Ensuite, la réservation en ligne se ferme si vous n&apos;êtes pas abonné.</>}</p>
      </div>
      {canManage ? <ButtonLink href="/app/reglages/abonnement" size="sm" variant={soon ? "primary" : "secondary"}>{sky ? t("Choisir mon abonnement") : "Choisir mon forfait"}</ButtonLink> : null}
    </div>
  );
}

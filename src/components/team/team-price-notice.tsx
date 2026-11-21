import Link from "next/link";
import { currentBrand } from "@/server/brand";
import { businessPricing, countBilledUsers } from "@/server/billing";
import { effectivePlan } from "@/server/plan";
import { teamQuote } from "@/lib/skydev-plans";
import { appT } from "@/server/app-locale";

/**
 * Skydev : prix de l'équipe, annoncé avant d'ajouter quelqu'un.
 * Sans abonnement payé (mois offert), on dit clairement que c'est gratuit maintenant et ce que ça coûtera ensuite.
 */
export async function TeamPriceNotice({ businessId }: { businessId: string }) {
  if ((await currentBrand()).id !== "skydev") return null;
  const t = await appT();
  const [users, plan, pricing] = await Promise.all([countBilledUsers(businessId), effectivePlan(businessId), businessPricing(businessId)]);
  const subscribed = plan.source === "stripe";
  const q = teamQuote(users, pricing);
  const total = q.monthly;
  const next = q.next;
  // Accès offert par l'équipe Skydev (hors essai) : rien à payer, pas de message de prix.
  if (plan.source === "granted" && !plan.isTrial) return null;
  const link = <Link href="/app/reglages/abonnement" className="font-medium text-accent hover:text-accent-hover">{subscribed ? t("Voir le détail") : t("S'abonner")}</Link>;
  if (!subscribed) {
    return (
      <p className="mb-4 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm" role="status">
        <span className="font-medium">{plan.isTrial ? t("Pendant l'essai gratuit, on ne peut pas ajouter de membre : pour ajouter une personne, abonnez-vous.") : t("Pour ajouter une personne, abonnez-vous.")}</span>{" "}
        {t("L'abonnement compte chaque personne de l'équipe, avec un prix qui baisse à chaque ajout :")}{" "}
        <span className="font-medium">{users} {users > 1 ? t("personnes") : t("personne")} = {total} € TVAC {t("par mois")}</span>
        {", "}{t("la prochaine personne ajoutée")} <span className="font-medium">{next ? `+${next} €` : t("offerte")}</span>.{" "}
        {users > 1 ? <>{t("Pour payer moins, retirez d'abord les personnes dont vous n'avez pas besoin (clic sur leur nom › Retirer de l'équipe).")}{" "}</> : null}
        {link}
      </p>
    );
  }
  return (
    <p className="mb-4 rounded-lg bg-surface-muted px-4 py-3 text-sm text-muted">
      {t("Votre abonnement compte chaque personne de l'équipe, avec un prix qui baisse à chaque ajout. La prochaine personne ajoutée coûtera")} <span className="font-medium text-text">{next ? `${next} € TVAC ${t("par mois")}` : t("rien (utilisateur offert)")}</span>, {t("au prorata.")}{" "}
      {link}
    </p>
  );
}

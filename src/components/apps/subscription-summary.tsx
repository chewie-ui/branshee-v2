import Link from "next/link";
import { CreditCard } from "lucide-react";
import type { Plan } from "@/lib/plans";
import { SKYDEV_NAME, USER_TIERS } from "@/lib/skydev-plans";

const fmt = (iso: string) => new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long" }).format(new Date(iso));

/** Bandeau compact en haut du lanceur : où en est l'abonnement, et le lien pour le gérer. */
export function SubscriptionSummary({ plan, addons }: { plan: { plan: Plan; source: string; isTrial: boolean; grantedUntil: string | null; cancelAtPeriodEnd: boolean; periodEnd: string | null }; addons: number }) {
  const paid = plan.source === "stripe" || plan.source === "account";
  const name = plan.plan === "free" ? null : SKYDEV_NAME;
  const title = paid && name ? `Abonnement ${name}` : plan.isTrial && plan.grantedUntil ? "Essai gratuit" : name ? `${name} · accès offert` : "Aucun abonnement";
  const detail = paid
    ? `${plan.cancelAtPeriodEnd && plan.periodEnd ? `Résilié, actif jusqu'au ${fmt(plan.periodEnd)}` : "Toutes les apps incluses"}${addons ? ` · ${addons} option${addons > 1 ? "s" : ""}` : ""}`
    : plan.isTrial && plan.grantedUntil
      ? `Jusqu'au ${fmt(plan.grantedUntil)}, puis dès ${USER_TIERS[0]} €/mois pour toutes les apps`
      : plan.plan === "free"
        ? "Abonnez-vous pour rouvrir vos apps"
        : "Toutes les apps incluses";
  return (
    <Link href="/app/reglages/abonnement" className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted" aria-hidden="true"><CreditCard className="size-[18px]" strokeWidth={1.75} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text">{title}</span>
        <span className="block truncate text-sm text-muted">{detail}</span>
      </span>
      <span className="shrink-0 text-sm font-medium text-accent">{paid ? "Gérer" : "Voir les abonnements"}</span>
    </Link>
  );
}

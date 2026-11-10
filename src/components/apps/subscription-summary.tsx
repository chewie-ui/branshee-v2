import Link from "next/link";
import { CreditCard } from "lucide-react";
import type { Plan } from "@/lib/plans";
import { SKYDEV_NAME, USER_TIERS } from "@/lib/skydev-plans";
import { makeT, type AppLocale } from "@/lib/i18n/app";

const fmtL = (iso: string, locale: AppLocale) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-BE", { day: "numeric", month: "long" }).format(new Date(iso));

/** Bandeau compact en haut du lanceur : où en est l'abonnement, et le lien pour le gérer. */
export function SubscriptionSummary({ plan, addons, locale = "fr" }: { plan: { plan: Plan; source: string; isTrial: boolean; grantedUntil: string | null; cancelAtPeriodEnd: boolean; periodEnd: string | null }; addons: number; locale?: AppLocale }) {
  const t = makeT(locale);
  const fmt = (iso: string) => fmtL(iso, locale);
  const paid = plan.source === "stripe" || plan.source === "account";
  const name = plan.plan === "free" ? null : SKYDEV_NAME;
  const title = paid && name ? t("Abonnement {name}", { name }) : plan.isTrial && plan.grantedUntil ? t("Essai gratuit") : name ? t("{name} · accès offert", { name }) : t("Aucun abonnement");
  const detail = paid
    ? `${plan.cancelAtPeriodEnd && plan.periodEnd ? t("Résilié, actif jusqu'au {date}", { date: fmt(plan.periodEnd) }) : t("Toutes les apps incluses")}${addons ? ` · ${t(addons > 1 ? "{n} options" : "{n} option", { n: addons })}` : ""}`
    : plan.isTrial && plan.grantedUntil
      ? t("Jusqu'au {date}, puis dès {price} €/mois pour toutes les apps", { date: fmt(plan.grantedUntil), price: USER_TIERS[0] ?? 29 })
      : plan.plan === "free"
        ? t("Abonnez-vous pour rouvrir vos apps")
        : t("Toutes les apps incluses");
  return (
    <Link href="/app/reglages/abonnement" className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted" aria-hidden="true"><CreditCard className="size-[18px]" strokeWidth={1.75} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text">{title}</span>
        <span className="block truncate text-sm text-muted">{detail}</span>
      </span>
      <span className="shrink-0 text-sm font-medium text-accent">{paid ? t("Gérer") : t("Voir les abonnements")}</span>
    </Link>
  );
}

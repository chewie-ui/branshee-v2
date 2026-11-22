import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Search } from "lucide-react";
import type { PageItem } from "@/lib/directory";
import { makeT, type AppLocale } from "@/lib/i18n/app";

/**
 * Accueil du pro : « Faites-vous trouver ». Version compacte (à côté de « Ma page en ligne », sous les apps) :
 * l'avancement de la page et la prochaine chose à compléter. Une page complète ressort avant les autres.
 */
export function PageScoreCard({ items, percent, searchHref, searchLabel, locale = "fr" }: { items: PageItem[]; percent: number; slug?: string; searchHref: string | null; searchLabel: string | null; locale?: AppLocale }) {
  const t = makeT(locale);
  const todo = items.filter((i) => !i.done);
  const next = todo[0];
  return (
    <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="page-score">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground" aria-hidden="true">{next ? <Search className="size-5" /> : <Check className="size-5" />}</span>
        <div className="min-w-0 flex-1">
          <h2 id="page-score" className="font-semibold">{next ? t("Faites-vous trouver") : t("Votre page est complète")}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {next
              ? t("Une page complète passe devant les autres dans l'annuaire et sur Google.")
              : searchLabel ? t("Les clients vous trouvent dans « {search} ».", { search: searchLabel }) : t("Elle ressort en priorité dans l'annuaire.")}
          </p>
        </div>
        <span className="shrink-0 text-lg font-semibold tabular-nums">{percent} %</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t("Page complétée")}>
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <div className="pt-4">
        {next ? (
          <Link href={next.href} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition-colors duration-150 hover:border-accent/40 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span className="text-muted">{t("À faire :")}</span>
            <span className="flex-1 truncate">{t(next.label)}</span>
            {todo.length > 1 ? <span className="shrink-0 text-xs text-muted">{t("+{n} autre(s)", { n: todo.length - 1 })}</span> : null}
            <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </Link>
        ) : searchHref ? (
          <Link href={searchHref} target="_blank" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover">{t("Voir dans l'annuaire")}<ExternalLink className="size-3.5" aria-hidden="true" /></Link>
        ) : null}
      </div>
    </section>
  );
}

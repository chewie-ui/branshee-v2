import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Globe } from "lucide-react";
import type { PageItem } from "@/lib/directory";

/**
 * Accueil du pro : « Votre page sur l'annuaire ». Pousse à compléter la page (une page complète
 * ressort avant les autres dans les résultats) et montre où les clients la trouvent.
 */
export function PageScoreCard({ items, percent, slug, searchHref, searchLabel }: { items: PageItem[]; percent: number; slug: string; searchHref: string | null; searchLabel: string | null }) {
  const todo = items.filter((i) => !i.done);
  if (!todo.length)
    return (
      <div className="mx-auto mb-8 flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface px-5 py-4 text-sm">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden="true"><Check className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Votre page est complète</span>
          <span className="block text-muted">{searchLabel ? `Les clients vous trouvent dans « ${searchLabel} ».` : "Elle ressort en priorité dans l'annuaire."}</span>
        </span>
        <span className="flex gap-3">
          {searchHref ? <Link href={searchHref} target="_blank" className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover">Voir dans l&apos;annuaire<ExternalLink className="size-3.5" aria-hidden="true" /></Link> : null}
        </span>
      </div>
    );
  return (
    <section className="mx-auto mb-8 max-w-3xl rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="page-score">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground" aria-hidden="true"><Globe className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="page-score" className="font-semibold">Faites-vous trouver par de nouveaux clients</h2>
          <p className="mt-0.5 text-sm text-muted">
            Les particuliers cherchent un pro par métier et par ville dans l&apos;annuaire et sur Google. Une page complète passe devant les autres.
          </p>
        </div>
        <span className="shrink-0 text-lg font-semibold tabular-nums">{percent} %</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Page complétée">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.key}>
            {i.done ? (
              <span className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted">
                <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                <span className="line-through decoration-border-strong">{i.label}</span>
              </span>
            ) : (
              <Link href={i.href} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition-colors duration-150 hover:border-accent/40 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <span className="size-4 shrink-0 rounded-full border-2 border-border-strong" aria-hidden="true" />
                <span className="flex-1">{i.label}</span>
                <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
              </Link>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link href={`/${slug}`} target="_blank" className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover">Voir ma page<ExternalLink className="size-3.5" aria-hidden="true" /></Link>
        <Link href="/app/page-de-reservation" className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover">Personnaliser ma page</Link>
        <Link href="/app/site" className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover">Créer mon site web</Link>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";
import { AppTile, CustomTile, StoreFooterCta, TRIAL_TEXT } from "@/components/store/store-parts";
import { METIERS, metierBySlug, storeApps } from "@/lib/app-store";
import { currentBrand } from "@/server/brand";

type Params = Promise<{ metier: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const m = metierBySlug((await params).metier);
  if (!m) return {};
  return { title: `${m.titre} — Skydev`, description: m.description, alternates: { canonical: `/logiciel/${m.slug}` } };
}

/** Page « Skydev pour un garage / un kiné… » : les apps utiles pour ce métier, et le sur mesure. */
export default async function MetierPage({ params }: { params: Params }) {
  if ((await currentBrand()).id !== "skydev") notFound();
  const m = metierBySlug((await params).metier);
  if (!m) notFound();
  const all = storeApps();
  const others = all.filter(({ app }) => app.billing !== "quote" && !m.apps.some((a) => a.id === app.id));

  return (
    <div className="tw mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href="/apps" className="hover:text-text">Apps</Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span aria-current="page" className="text-text">{m.nom}</span>
      </nav>
      <span className="mt-6 inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-soft-foreground">{TRIAL_TEXT}</span>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{m.titre}</h1>
      <p className="mt-4 max-w-prose text-lg text-muted">{m.intro}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/inscription" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors duration-150 hover:bg-accent-hover"><span className="inline-flex items-center gap-2 text-accent-foreground">Essayer gratuitement<ArrowRight className="size-4" aria-hidden="true" /></span></Link>
        <Link href="/#contact" className="inline-flex min-h-11 items-center rounded-xl border border-border-strong bg-surface px-5 text-sm font-semibold transition-colors duration-150 hover:bg-surface-muted"><span>Nous parler de votre activité</span></Link>
      </div>

      <section className="mt-12" aria-labelledby="apps-metier">
        <h2 id="apps-metier" className="text-xl font-semibold tracking-tight">Les apps utiles pour {m.un}</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {m.apps.map(({ id, pourquoi }) => {
            const x = all.find((a) => a.app.id === id);
            return x ? <li key={id}><AppTile app={x.app} store={x.store} note={pourquoi} /></li> : null;
          })}
          <li><CustomTile ideas={m.surMesure} /></li>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="autres-apps">
        <h2 id="autres-apps" className="text-xl font-semibold tracking-tight">Et toutes les autres, sans supplément</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {others.map(({ app, store }) => (
            <li key={app.id}><Link href={`/apps/${store.slug}`} className="inline-flex min-h-10 items-center rounded-full border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted"><span>{app.name}</span></Link></li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="autres-metiers">
        <h2 id="autres-metiers" className="text-xl font-semibold tracking-tight">Skydev pour d&apos;autres métiers</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {METIERS.filter((x) => x.slug !== m.slug).map((x) => (
            <li key={x.slug}><Link href={`/logiciel/${x.slug}`} className="inline-flex min-h-10 items-center rounded-full border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted"><span>{x.nom}</span></Link></li>
          ))}
        </ul>
      </section>

      <StoreFooterCta title={`Skydev pour ${m.un}, essayez-le gratuitement`} />
    </div>
  );
}

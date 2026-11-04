import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { AppTile, CustomTile, TRIAL_TEXT } from "@/components/store/store-parts";
import type { AppCategory } from "@/lib/apps";
import { METIERS, metierBySlug, metiersOfApp, storeApps, storeCount } from "@/lib/app-store";
import { StoreBrowser } from "@/components/store/store-browser";
import { cn } from "@/lib/cn";
import { currentBrand } from "@/server/brand";
import { getSessionUser } from "@/server/auth/session";
import { StoreFooterCta } from "@/components/store/store-cta";

type Search = Promise<{ metier?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const m = metierBySlug((await searchParams).metier ?? "");
  return {
    title: m ? `Apps pour ${m.un} — Skydev` : `Toutes les apps Skydev : ${storeCount()} apps pour gérer votre activité`,
    description: `Rendez-vous, factures, caisse, boutique, stock, planning, fidélité, véhicules… ${storeCount()} apps reliées entre elles dans un seul abonnement dès 29 €/mois. ${TRIAL_TEXT}.`,
    // Les filtres par métier ont leur propre page (/logiciel/<métier>) : une seule adresse pour Google.
    alternates: { canonical: m ? `/logiciel/${m.slug}` : "/apps" },
  };
}

const ORDER: AppCategory[] = ["clients", "finance", "operations", "equipe", "marketing", "services"];

/** App store public : toutes les apps, filtrables par métier, avec le sur mesure en dernière carte. */
export default async function AppStore({ searchParams }: { searchParams: Search }) {
  if ((await currentBrand()).id !== "skydev") notFound();
  const metier = metierBySlug((await searchParams).metier ?? "");
  const all = storeApps().filter(({ app }) => app.billing !== "quote");
  const chip = (active: boolean) => cn("inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-150", active ? "border-accent bg-accent text-accent-foreground" : "border-border-strong bg-surface hover:bg-surface-muted");

  return (
    <div className="tw mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      {!(await getSessionUser()) ? <span className="mb-4 inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-soft-foreground">{TRIAL_TEXT}</span> : null}
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{storeCount()} apps pour gérer toute votre activité</h1>
      <p className="mt-4 max-w-prose text-lg text-muted">Activez seulement celles dont vous avez besoin. Elles partagent vos clients, votre agenda et votre stock : rien à encoder deux fois. Toutes sont incluses dans un seul abonnement dès 29 € par mois, sauf les options. Et s&apos;il manque une fonction, on l&apos;ajoute pour vous.</p>

      <nav aria-label="Filtrer par métier" className="mt-8">
        <p className="mb-3 text-sm font-medium">Votre métier</p>
        <ul className="flex flex-wrap gap-2">
          <li><Link href="/apps" scroll={false} className={chip(!metier)} aria-current={!metier ? "page" : undefined}><span className={!metier ? "text-accent-foreground" : undefined}>Toutes les apps</span></Link></li>
          {METIERS.map((m) => (
            <li key={m.slug}><Link href={`/apps?metier=${m.slug}`} scroll={false} className={chip(metier?.slug === m.slug)} aria-current={metier?.slug === m.slug ? "page" : undefined}><span className={metier?.slug === m.slug ? "text-accent-foreground" : undefined}>{m.nom}</span></Link></li>
          ))}
        </ul>
      </nav>

      {metier ? (
        <section className="mt-10" aria-labelledby="pack">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="pack" className="text-xl font-semibold tracking-tight">Pour {metier.un}</h2>
              <p className="mt-1 max-w-prose text-muted">{metier.intro}</p>
            </div>
            <Link href={`/logiciel/${metier.slug}`} className="inline-flex items-center gap-1 text-sm font-medium"><span className="text-accent hover:underline">Tout sur Skydev pour {metier.un}</span><ArrowRight className="size-4 text-accent" aria-hidden="true" /></Link>
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metier.apps.map(({ id, pourquoi }) => {
              const x = all.find((a) => a.app.id === id);
              return x ? <li key={id}><AppTile app={x.app} store={x.store} note={pourquoi} /></li> : null;
            })}
            <li><CustomTile ideas={metier.surMesure} /></li>
          </ul>
          <p className="mt-8 text-sm text-muted">Les autres apps restent disponibles à tout moment, sans supplément.</p>
        </section>
      ) : (
        <StoreBrowser items={all.map((x) => ({ ...x, metiers: metiersOfApp(x.app.id).map((m) => `${m.nom} ${m.titre}`) }))} order={ORDER} />
      )}

      <section className="mt-16 grid gap-6 rounded-3xl border border-border bg-surface p-6 sm:p-8 lg:grid-cols-2" aria-labelledby="pourquoi">
        <div>
          <h2 id="pourquoi" className="text-xl font-semibold tracking-tight">Pourquoi tout au même endroit ?</h2>
          <p className="mt-2 text-muted">Un rendez-vous crée la fiche client, la facture reprend la prestation, la vente fait baisser le stock, la fidélité ajoute le tampon. Vous gagnez le temps que vous passiez à recopier.</p>
        </div>
        <ul className="space-y-2.5 text-sm">
          {["Un seul abonnement, un seul identifiant", "Vos données en Europe, sauvegardées chaque nuit", "Chaque employé ne voit que ce qui le concerne", "Un interlocuteur à Wavre, pas un centre d'appels"].map((t) => (
            <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />{t}</li>
          ))}
        </ul>
      </section>

      <StoreFooterCta />
    </div>
  );
}

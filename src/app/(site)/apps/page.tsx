import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { AppTile, CustomTile, TRIAL_TEXT_L } from "@/components/store/store-parts";
import type { AppCategory } from "@/lib/apps";
import { METIERS, metiersOfApp, storeCount } from "@/lib/app-store";
import { metierBySlugAny, metierHrefL, metierL, storeAppsL } from "@/lib/app-store-i18n";
import { StoreBrowser } from "@/components/store/store-browser";
import { cn } from "@/lib/cn";
import { localize } from "@/lib/site-locale";
import { currentBrand } from "@/server/brand";
import { getSessionUser } from "@/server/auth/session";
import { StoreFooterCta } from "@/components/store/store-cta";
import { siteLocale } from "@/server/site-locale";

type Search = Promise<{ metier?: string }>;

const T = {
  fr: {
    title: (n: number) => `Toutes les apps Skydev : ${n} apps pour gérer votre activité`,
    titleFor: (un: string) => `Apps pour ${un} — Skydev`,
    description: (n: number, trial: string) => `Rendez-vous, factures, caisse, boutique, stock, planning, fidélité, véhicules… ${n} apps reliées entre elles dans un seul abonnement dès 29 €/mois. ${trial}.`,
    h1: (n: number) => `${n} apps pour gérer toute votre activité`,
    lead: "Activez seulement celles dont vous avez besoin. Elles partagent vos clients, votre agenda et votre stock : rien à encoder deux fois. Toutes sont incluses dans un seul abonnement dès 29 € par mois, sauf les options. Et s'il manque une fonction, on l'ajoute pour vous.",
    filter: "Filtrer par métier", yours: "Votre métier", all: "Toutes les apps",
    for: (un: string) => `Pour ${un}`, allFor: (un: string) => `Tout sur Skydev pour ${un}`,
    others: "Les autres apps restent disponibles à tout moment, sans supplément.",
    whyT: "Pourquoi tout au même endroit ?",
    whyD: "Un rendez-vous crée la fiche client, la facture reprend la prestation, la vente fait baisser le stock, la fidélité ajoute le tampon. Vous gagnez le temps que vous passiez à recopier.",
    why: ["Un seul abonnement, un seul identifiant", "Vos données en Europe, sauvegardées chaque nuit", "Chaque employé ne voit que ce qui le concerne", "Un interlocuteur à Wavre, pas un centre d'appels"],
  },
  en: {
    title: (n: number) => `All Skydev apps: ${n} apps to run your business`,
    titleFor: (un: string) => `Apps for ${un} — Skydev`,
    description: (n: number, trial: string) => `Bookings, clients, point of sale, online shop, stock, scheduling, loyalty, car showroom… ${n} connected apps in one subscription from €29/month. ${trial}.`,
    h1: (n: number) => `${n} apps to run your whole business`,
    lead: "Turn on only the ones you need. They share your clients, calendar and stock: nothing to enter twice. All are included in one subscription from €29 a month, except add-ons. Apps marked “Belgium only” follow Belgian rules (VAT, invoices, payroll). And if a feature is missing, we build it for you.",
    filter: "Filter by trade", yours: "Your trade", all: "All apps",
    for: (un: string) => `For ${un}`, allFor: (un: string) => `Skydev for ${un}`,
    others: "Every other app stays available anytime, at no extra cost.",
    whyT: "Why everything in one place?",
    whyD: "A booking creates the client record, a sale lowers the stock, the loyalty card gets its stamp. You get back the time you used to spend copying things over.",
    why: ["One subscription, one login", "Your data hosted in Europe, backed up every night", "Each employee only sees what concerns them", "A real person to talk to, not a call centre"],
  },
};

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const l = await siteLocale();
  const m0 = metierBySlugAny((await searchParams).metier ?? "");
  const m = m0 ? metierL(m0, l) : null;
  return {
    title: m ? T[l].titleFor(m.un) : T[l].title(storeCount()),
    description: T[l].description(storeCount(), TRIAL_TEXT_L[l]),
    // Les filtres par métier ont leur propre page (/logiciel/<métier>) : une seule adresse pour Google.
    alternates: { canonical: m ? metierHrefL(m, l) : localize("/apps", l), languages: { fr: "/apps", en: "/en/apps" } },
  };
}

const ORDER: AppCategory[] = ["clients", "finance", "operations", "equipe", "marketing", "services"];

/** App store public : toutes les apps, filtrables par métier, avec le sur mesure en dernière carte. */
export default async function AppStore({ searchParams }: { searchParams: Search }) {
  if ((await currentBrand()).id !== "skydev") notFound();
  const l = await siteLocale();
  const t = T[l];
  const m0 = metierBySlugAny((await searchParams).metier ?? "");
  const metier = m0 ? metierL(m0, l) : null;
  const all = storeAppsL(l).filter(({ app }) => app.billing !== "quote");
  const chip = (active: boolean) => cn("inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-150", active ? "border-accent bg-accent text-accent-foreground" : "border-border-strong bg-surface hover:bg-surface-muted");

  return (
    <div className="tw mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      {!(await getSessionUser()) ? <span className="mb-4 inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-soft-foreground">{TRIAL_TEXT_L[l]}</span> : null}
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.h1(storeCount())}</h1>
      <p className="mt-4 max-w-prose text-lg text-muted">{t.lead}</p>

      <nav aria-label={t.filter} className="mt-8">
        <p className="mb-3 text-sm font-medium">{t.yours}</p>
        <ul className="flex flex-wrap gap-2">
          <li><Link href={localize("/apps", l)} scroll={false} className={chip(!metier)} aria-current={!metier ? "page" : undefined}><span className={!metier ? "text-accent-foreground" : undefined}>{t.all}</span></Link></li>
          {METIERS.map((m0) => {
            const m = metierL(m0, l);
            const on = metier?.slug === m.slug;
            return <li key={m.slug}><Link href={`${localize("/apps", l)}?metier=${m.slug}`} scroll={false} className={chip(on)} aria-current={on ? "page" : undefined}><span className={on ? "text-accent-foreground" : undefined}>{m.nom}</span></Link></li>;
          })}
        </ul>
      </nav>

      {metier ? (
        <section className="mt-10" aria-labelledby="pack">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="pack" className="text-xl font-semibold tracking-tight">{t.for(metier.un)}</h2>
              <p className="mt-1 max-w-prose text-muted">{metier.intro}</p>
            </div>
            <Link href={metierHrefL(metier, l)} className="inline-flex items-center gap-1 text-sm font-medium"><span className="text-accent hover:underline">{t.allFor(metier.un)}</span><ArrowRight className="size-4 text-accent" aria-hidden="true" /></Link>
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metier.apps.map(({ id, pourquoi }) => {
              const x = all.find((a) => a.app.id === id);
              return x ? <li key={id}><AppTile app={x.app} store={x.store} note={pourquoi} locale={l} /></li> : null;
            })}
            <li><CustomTile ideas={metier.surMesure} locale={l} /></li>
          </ul>
          <p className="mt-8 text-sm text-muted">{t.others}</p>
        </section>
      ) : (
        <StoreBrowser locale={l} items={all.map((x) => ({ ...x, metiers: metiersOfApp(x.app.id).map((m) => { const ml = metierL(m, l); return `${ml.nom} ${ml.titre}`; }) }))} order={ORDER} />
      )}

      <section className="mt-16 grid gap-6 rounded-3xl border border-border bg-surface p-6 sm:p-8 lg:grid-cols-2" aria-labelledby="pourquoi">
        <div>
          <h2 id="pourquoi" className="text-xl font-semibold tracking-tight">{t.whyT}</h2>
          <p className="mt-2 text-muted">{t.whyD}</p>
        </div>
        <ul className="space-y-2.5 text-sm">
          {t.why.map((w) => (
            <li key={w} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />{w}</li>
          ))}
        </ul>
      </section>

      <StoreFooterCta locale={l} />
    </div>
  );
}

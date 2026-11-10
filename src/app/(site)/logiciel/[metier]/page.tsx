import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";
import { AppTile, CustomTile, TRIAL_TEXT_L } from "@/components/store/store-parts";
import { METIERS } from "@/lib/app-store";
import { metierBySlugAny, metierHrefL, metierL, storeAppsL, storeHrefL } from "@/lib/app-store-i18n";
import { localize } from "@/lib/site-locale";
import { currentBrand } from "@/server/brand";
import { StoreFooterCta } from "@/components/store/store-cta";
import { getSessionUser } from "@/server/auth/session";
import { siteLocale } from "@/server/site-locale";

type Params = Promise<{ metier: string }>;

const T = {
  fr: {
    crumb: "Fil d'Ariane", open: "Ouvrir mes apps", try: "Essayer gratuitement", talk: "Nous parler de votre activité",
    useful: (un: string) => `Les apps utiles pour ${un}`, others: "Et toutes les autres, sans supplément", otherTrades: "Skydev pour d'autres métiers",
    cta: (un: string) => `Skydev pour ${un}, essayez-le gratuitement`,
  },
  en: {
    crumb: "Breadcrumb", open: "Open my apps", try: "Try it for free", talk: "Tell us about your business",
    useful: (un: string) => `Useful apps for ${un}`, others: "And every other app, at no extra cost", otherTrades: "Skydev for other trades",
    cta: (un: string) => `Skydev for ${un}: try it for free`,
  },
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const l = await siteLocale();
  const m0 = metierBySlugAny((await params).metier);
  if (!m0) return {};
  const m = metierL(m0, l);
  return { title: m.titre, description: m.description, alternates: { canonical: metierHrefL(m0, l), languages: { fr: metierHrefL(m0, "fr"), en: metierHrefL(m0, "en") } } };
}

/** Page « Skydev pour un garage / un kiné… » : les apps utiles pour ce métier, et le sur mesure. */
export default async function MetierPage({ params }: { params: Params }) {
  if ((await currentBrand()).id !== "skydev") notFound();
  const l = await siteLocale();
  const t = T[l];
  const m0 = metierBySlugAny((await params).metier);
  if (!m0) notFound();
  const m = metierL(m0, l);
  const all = storeAppsL(l);
  const signedIn = !!(await getSessionUser());
  const others = all.filter(({ app }) => app.billing !== "quote" && !m.apps.some((a) => a.id === app.id));

  return (
    <div className="tw mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <nav aria-label={t.crumb} className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href={localize("/apps", l)} className="hover:text-text">Apps</Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span aria-current="page" className="text-text">{m.nom}</span>
      </nav>
      {!signedIn ? <span className="mt-6 inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-soft-foreground">{TRIAL_TEXT_L[l]}</span> : <span className="mt-6 block" />}
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{m.titre}</h1>
      <p className="mt-4 max-w-prose text-lg text-muted">{m.intro}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={signedIn ? "/app/apps" : localize("/inscription", l)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors duration-150 hover:bg-accent-hover"><span className="inline-flex items-center gap-2 text-accent-foreground">{signedIn ? t.open : t.try}<ArrowRight className="size-4" aria-hidden="true" /></span></Link>
        <Link href={localize("/#contact", l)} className="inline-flex min-h-11 items-center rounded-xl border border-border-strong bg-surface px-5 text-sm font-semibold transition-colors duration-150 hover:bg-surface-muted"><span>{t.talk}</span></Link>
      </div>

      <section className="mt-12" aria-labelledby="apps-metier">
        <h2 id="apps-metier" className="text-xl font-semibold tracking-tight">{t.useful(m.un)}</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {m.apps.map(({ id, pourquoi }) => {
            const x = all.find((a) => a.app.id === id);
            return x ? <li key={id}><AppTile app={x.app} store={x.store} note={pourquoi} locale={l} /></li> : null;
          })}
          <li><CustomTile ideas={m.surMesure} locale={l} /></li>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="autres-apps">
        <h2 id="autres-apps" className="text-xl font-semibold tracking-tight">{t.others}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {others.map(({ app }) => (
            <li key={app.id}><Link href={storeHrefL(app.id, l)} className="inline-flex min-h-10 items-center rounded-full border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted"><span>{app.name}</span></Link></li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="autres-metiers">
        <h2 id="autres-metiers" className="text-xl font-semibold tracking-tight">{t.otherTrades}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {METIERS.filter((x) => x.slug !== m0.slug).map((x) => (
            <li key={x.slug}><Link href={metierHrefL(x, l)} className="inline-flex min-h-10 items-center rounded-full border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted"><span>{metierL(x, l).nom}</span></Link></li>
          ))}
        </ul>
      </section>

      <StoreFooterCta title={t.cta(m.un)} locale={l} />
    </div>
  );
}

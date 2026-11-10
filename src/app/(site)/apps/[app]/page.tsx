import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight, Check, ChevronRight, Globe2, Lightbulb } from "lucide-react";
import { AppIcon } from "@/components/apps/app-icon";
import { AppTile, BillingBadge, ReachBadge, TRIAL_TEXT_L } from "@/components/store/store-parts";
import { appById } from "@/lib/apps";
import { APP_REACH, appText } from "@/lib/apps-i18n";
import { metiersOfApp, storeAppById } from "@/lib/app-store";
import { metierHrefL, metierL, storeAppBySlugAny, storeHrefL, storeL } from "@/lib/app-store-i18n";
import { localize, type SiteLocale } from "@/lib/site-locale";
import { currentBrand } from "@/server/brand";
import { StoreFooterCta } from "@/components/store/store-cta";
import { getSessionUser } from "@/server/auth/session";
import { siteUrl } from "@/server/site";
import { siteLocale } from "@/server/site-locale";

type Params = Promise<{ app: string }>;

const T = {
  fr: {
    meta: (titre: string, name: string) => `${titre} — ${name}, app Skydev`, crumb: "Fil d'Ariane", trades: "Métiers concernés", does: "Ce que fait l'app", examples: "Par exemple", usedBy: "Utilisée par",
    addon: "En option sur l'abonnement Skydev", included: "Incluse dans l'abonnement Skydev", addonD: "Activez-la quand vous voulez depuis votre espace.", includedD: "Dès 29 € par mois, toutes les apps incluses, sans engagement.",
    open: (n: string) => `Ouvrir ${n}`, try: "Essayer gratuitement", sub: "Mon abonnement", prices: "Voir les tarifs",
    missingT: (n: string) => `Il manque une fonction à ${n} ?`, missingD: "Dites-nous laquelle : on l'ajoute à votre espace, adaptée à votre façon de travailler.", ask: "Demander une fonction",
    with: "Va bien avec", tryT: (n: string) => `Essayez ${n} gratuitement`, offer: "Abonnement mensuel Skydev, toutes les apps incluses", beNote: "",
  },
  en: {
    meta: (titre: string) => titre, crumb: "Breadcrumb", trades: "Who it's for", does: "What the app does", examples: "For example", usedBy: "Used by",
    addon: "Add-on to your Skydev subscription", included: "Included in your Skydev subscription", addonD: "Turn it on whenever you want from your space.", includedD: "From €29 a month, every app included, no commitment.",
    open: (n: string) => `Open ${n}`, try: "Try it for free", sub: "My subscription", prices: "See pricing",
    missingT: (n: string) => `Missing a feature in ${n}?`, missingD: "Tell us which one: we add it to your space, adapted to the way you work.", ask: "Request a feature",
    with: "Works well with", tryT: (n: string) => `Try ${n} for free`, offer: "Skydev monthly subscription, every app included",
    beNote: "This app follows Belgian rules (VAT, legal mentions or local providers). It's available to businesses based in Belgium; versions for other countries can be built on request.",
  },
};

function load(slug: string, l: SiteLocale) {
  const base = storeAppBySlugAny(slug);
  if (!base) return null;
  const app0 = appById(base.id);
  if (!app0 || app0.status !== "active") return null;
  return { app: { ...app0, ...appText(app0, l) }, store: storeL(base, l) };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const l = await siteLocale();
  const d = load((await params).app, l);
  if (!d) return {};
  return { title: T[l].meta(d.store.titre, d.app.name), description: d.store.description, alternates: { canonical: storeHrefL(d.app.id, l), languages: { fr: storeHrefL(d.app.id, "fr"), en: storeHrefL(d.app.id, "en") } } };
}

/** Fiche publique d'une app : à quoi elle sert, fonctions, exemples, métiers, apps liées, sur mesure. */
export default async function AppPage({ params }: { params: Params }) {
  if ((await currentBrand()).id !== "skydev") notFound();
  const l = await siteLocale();
  const t = T[l];
  const d = load((await params).app, l);
  if (!d) notFound();
  // Le sur mesure a ses propres pages.
  if (d.app.billing === "quote") permanentRedirect(localize("/sur-mesure", l));
  const { app, store } = d;
  const signedIn = !!(await getSessionUser());
  const quote = app.billing === "quote";
  const metiers = metiersOfApp(app.id).map((m) => metierL(m, l));
  const related = store.avec
    .map((id) => { const a = appById(id); return { app: { ...a, ...appText(a, l) }, store: storeL(storeAppById(id), l) }; })
    .filter((x) => x.app?.status === "active");
  const url = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `Skydev ${app.name}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    description: store.description,
    url: `${url}${storeHrefL(app.id, l)}`,
    inLanguage: l,
    ...(app.billing === "included" ? { offers: { "@type": "Offer", price: "29.00", priceCurrency: "EUR", description: t.offer } } : {}),
  };

  return (
    <div className="tw mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label={t.crumb} className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href={localize("/apps", l)} className="hover:text-text">Apps</Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span aria-current="page" className="text-text">{app.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-foreground"><AppIcon icon={app.icon} className="size-6" /></span>
            <div>
              <p className="flex flex-wrap items-center gap-2 font-semibold">{app.name}<BillingBadge billing={app.billing} locale={l} /><ReachBadge id={app.id} locale={l} /></p>
              <p className="text-sm text-muted">{app.tagline}</p>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{store.titre}</h1>
          <p className="mt-4 max-w-prose text-lg text-muted">{store.intro}</p>
          {l === "en" && APP_REACH[app.id] === "be" ? (
            <p className="mt-4 flex max-w-prose gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning"><Globe2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{t.beNote}</p>
          ) : null}
          {store.tags.length ? (
            <div className="mt-5">
              <p className="text-sm font-medium">{t.trades}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {store.tags.map((tag) => <li key={tag} className="rounded-md bg-surface-muted px-2.5 py-1 text-sm text-muted">{tag}</li>)}
              </ul>
            </div>
          ) : null}

          {app.features.length ? (
            <section className="mt-10" aria-labelledby="fonctions">
              <h2 id="fonctions" className="text-xl font-semibold tracking-tight">{t.does}</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {app.features.map((f) => (
                  <li key={f} className="flex gap-2.5 rounded-xl border border-border bg-surface p-4 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />{f}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-10" aria-labelledby="exemples">
            <h2 id="exemples" className="text-xl font-semibold tracking-tight">{t.examples}</h2>
            <ul className="mt-4 space-y-2.5">
              {store.usages.map((u) => (
                <li key={u} className="flex gap-2.5"><Lightbulb className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />{u}</li>
              ))}
            </ul>
          </section>

          {metiers.length ? (
            <section className="mt-10" aria-labelledby="metiers">
              <h2 id="metiers" className="text-xl font-semibold tracking-tight">{t.usedBy}</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {metiers.map((m) => (
                  <li key={m.slug}><Link href={metierHrefL(m, l)} className="inline-flex min-h-10 items-center rounded-full border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted"><span>{m.nom}</span></Link></li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="font-semibold">{app.billing === "addon" ? t.addon : t.included}</p>
            <p className="mt-1 text-sm text-muted">{app.billing === "addon" ? t.addonD : t.includedD}</p>
            {!signedIn ? <p className="mt-3 inline-flex rounded-md bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">{TRIAL_TEXT_L[l]}</p> : null}
            <Link href={signedIn ? app.href : localize("/inscription", l)} className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"><span className="inline-flex items-center gap-2 text-accent-foreground">{signedIn ? t.open(app.name) : t.try}<ArrowRight className="size-4" aria-hidden="true" /></span></Link>
            <Link href={signedIn ? "/app/reglages/abonnement" : localize("/#tarifs", l)} className="mt-2 flex min-h-11 items-center justify-center rounded-xl border border-border-strong bg-surface px-5 text-sm font-semibold hover:bg-surface-muted"><span>{signedIn ? t.sub : t.prices}</span></Link>
          </div>
          {!quote ? (
            <div className="rounded-2xl border border-border bg-surface p-5 text-sm">
              <p className="font-semibold">{t.missingT(app.name)}</p>
              <p className="mt-1 text-muted">{t.missingD}</p>
              <Link href={signedIn ? "/app/sur-mesure" : localize("/#contact", l)} className="mt-3 inline-flex items-center gap-1 font-medium"><span className="text-accent hover:underline">{t.ask}</span><ArrowRight className="size-4 text-accent" aria-hidden="true" /></Link>
            </div>
          ) : null}
        </aside>
      </div>

      {related.length ? (
        <section className="mt-16" aria-labelledby="avec">
          <h2 id="avec" className="text-xl font-semibold tracking-tight">{t.with}</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => <li key={r.app.id}><AppTile app={r.app} store={r.store} locale={l} /></li>)}
          </ul>
        </section>
      ) : null}

      <StoreFooterCta title={t.tryT(app.name)} locale={l} />
    </div>
  );
}

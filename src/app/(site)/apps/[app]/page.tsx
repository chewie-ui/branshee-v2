import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight, Check, ChevronRight, Lightbulb } from "lucide-react";
import { AppIcon } from "@/components/apps/app-icon";
import { AppTile, BillingBadge, StoreFooterCta, TRIAL_TEXT } from "@/components/store/store-parts";
import { appById } from "@/lib/apps";
import { metiersOfApp, storeAppById, storeAppBySlug } from "@/lib/app-store";
import { currentBrand } from "@/server/brand";
import { siteUrl } from "@/server/site";

type Params = Promise<{ app: string }>;

function load(slug: string) {
  const store = storeAppBySlug(slug);
  if (!store) return null;
  const app = appById(store.id);
  if (!app || app.status !== "active") return null;
  return { app, store };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const d = load((await params).app);
  if (!d) return {};
  return { title: `${d.store.titre} — ${d.app.name}, app Skydev`, description: d.store.description, alternates: { canonical: `/apps/${d.store.slug}` } };
}

/** Fiche publique d'une app : à quoi elle sert, fonctions, exemples, métiers, apps liées, sur mesure. */
export default async function AppPage({ params }: { params: Params }) {
  if ((await currentBrand()).id !== "skydev") notFound();
  const d = load((await params).app);
  if (!d) notFound();
  // Le sur mesure a ses propres pages.
  if (d.app.billing === "quote") permanentRedirect("/sur-mesure");
  const { app, store } = d;
  const quote = app.billing === "quote";
  const metiers = metiersOfApp(app.id);
  const related = store.avec.map((id) => ({ app: appById(id), store: storeAppById(id) })).filter((x) => x.app?.status === "active");
  const url = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `Skydev ${app.name}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    description: store.description,
    url: `${url}/apps/${store.slug}`,
    ...(app.billing === "included" ? { offers: { "@type": "Offer", price: "29.00", priceCurrency: "EUR", description: "Abonnement mensuel Skydev, toutes les apps incluses" } } : {}),
  };

  return (
    <div className="tw mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href="/apps" className="hover:text-text">Apps</Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span aria-current="page" className="text-text">{app.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-foreground"><AppIcon icon={app.icon} className="size-6" /></span>
            <div>
              <p className="flex items-center gap-2 font-semibold">{app.name}<BillingBadge billing={app.billing} /></p>
              <p className="text-sm text-muted">{app.tagline}</p>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{store.titre}</h1>
          <p className="mt-4 max-w-prose text-lg text-muted">{store.intro}</p>

          {app.features.length ? (
            <section className="mt-10" aria-labelledby="fonctions">
              <h2 id="fonctions" className="text-xl font-semibold tracking-tight">Ce que fait l&apos;app</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {app.features.map((f) => (
                  <li key={f} className="flex gap-2.5 rounded-xl border border-border bg-surface p-4 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />{f}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-10" aria-labelledby="exemples">
            <h2 id="exemples" className="text-xl font-semibold tracking-tight">Par exemple</h2>
            <ul className="mt-4 space-y-2.5">
              {store.usages.map((u) => (
                <li key={u} className="flex gap-2.5"><Lightbulb className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />{u}</li>
              ))}
            </ul>
          </section>

          {metiers.length ? (
            <section className="mt-10" aria-labelledby="metiers">
              <h2 id="metiers" className="text-xl font-semibold tracking-tight">Utilisée par</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {metiers.map((m) => (
                  <li key={m.slug}><Link href={`/logiciel/${m.slug}`} className="inline-flex min-h-10 items-center rounded-full border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted"><span>{m.nom}</span></Link></li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5">
            {quote ? (
              <>
                <p className="font-semibold">Sur devis, prix fixe</p>
                <p className="mt-1 text-sm text-muted">Estimation sous 24 h, puis une maquette avant de payer quoi que ce soit.</p>
                <Link href="/#contact" className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"><span className="inline-flex items-center gap-2 text-accent-foreground">Décrire mon besoin<ArrowRight className="size-4" aria-hidden="true" /></span></Link>
              </>
            ) : (
              <>
                <p className="font-semibold">{app.billing === "addon" ? "En option sur l'abonnement Skydev" : "Incluse dans l'abonnement Skydev"}</p>
                <p className="mt-1 text-sm text-muted">{app.billing === "addon" ? "Activez-la quand vous voulez depuis votre espace." : "Dès 29 € par mois, toutes les apps incluses, sans engagement."}</p>
                <p className="mt-3 inline-flex rounded-md bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">{TRIAL_TEXT}</p>
                <Link href="/inscription" className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"><span className="inline-flex items-center gap-2 text-accent-foreground">Essayer gratuitement<ArrowRight className="size-4" aria-hidden="true" /></span></Link>
                <Link href="/#tarifs" className="mt-2 flex min-h-11 items-center justify-center rounded-xl border border-border-strong bg-surface px-5 text-sm font-semibold hover:bg-surface-muted"><span>Voir les tarifs</span></Link>
              </>
            )}
          </div>
          {!quote ? (
            <div className="rounded-2xl border border-border bg-surface p-5 text-sm">
              <p className="font-semibold">Il manque une fonction à {app.name} ?</p>
              <p className="mt-1 text-muted">Dites-nous laquelle : on l&apos;ajoute à votre espace, adaptée à votre façon de travailler.</p>
              <Link href="/#contact" className="mt-3 inline-flex items-center gap-1 font-medium"><span className="text-accent hover:underline">Demander une fonction</span><ArrowRight className="size-4 text-accent" aria-hidden="true" /></Link>
            </div>
          ) : null}
        </aside>
      </div>

      {related.length ? (
        <section className="mt-16" aria-labelledby="avec">
          <h2 id="avec" className="text-xl font-semibold tracking-tight">Va bien avec</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => <li key={r.app.id}><AppTile app={r.app} store={r.store} /></li>)}
          </ul>
        </section>
      ) : null}

      <StoreFooterCta title={quote ? "Commencez avec les apps Skydev" : `Essayez ${app.name} gratuitement`} />
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Mail, Phone } from "lucide-react";
import { DirectoryFaq } from "@/components/directory/directory-faq";
import { SERVICE_CITIES, type CustomService } from "@/lib/custom-services";
import { customServicesL } from "@/lib/custom-services-i18n";
import { localize, type SiteLocale } from "@/lib/site-locale";

const T = {
  fr: { crumb: "Sur mesure", cta: "Demander un devis gratuit", phone: "0477 44 39 88", how: "Comment ça se passe", steps: [{ t: "On en parle", d: "15 minutes au téléphone ou en visio pour comprendre votre besoin." }, { t: "Maquette et prix fixe", d: "Une estimation sous 24 h, puis une maquette avant de payer." }, { t: "Mise en ligne", d: "Vous validez, c'est en ligne, et relié à Skydev si vous le voulez." }], price: "Tarif", priceNote: "Prix fixe annoncé avant de commencer. Devis gratuit sous 24 h.", toolsT: "Et vos outils au quotidien ?", toolsD: "Rendez-vous, factures, caisse, stock, clients : la plateforme Skydev réunit tout, dès 29 € par mois.", toolsCta: "Découvrir la plateforme", others: "Nos autres services sur mesure", breadcrumb: "Fil d'Ariane" },
  en: { crumb: "Custom work", cta: "Get a free estimate", phone: "+32 477 44 39 88", how: "How it works", steps: [{ t: "We talk", d: "15 minutes by phone or video to understand what you need." }, { t: "Mock-up and fixed price", d: "An estimate within 24 hours, then a mock-up before you pay." }, { t: "Launch", d: "You approve, it goes live, connected to Skydev if you want." }], price: "Price", priceNote: "Fixed price agreed before we start. Free estimate within 24 hours.", toolsT: "And your everyday tools?", toolsD: "Bookings, clients, point of sale, stock, tasks: the Skydev platform brings it all together, from €29 a month.", toolsCta: "Discover the platform", others: "Our other custom services", breadcrumb: "Breadcrumb" },
};

/** Page d'un service sur mesure (et sa déclinaison par ville) : contenu, liens internes, contact. */
export function ServicePage({ service, ville, jsonLd, locale = "fr" }: { service: CustomService; ville?: { slug: string; nom: string }; jsonLd: object; locale?: SiteLocale }) {
  const t = T[locale];
  const L = (h: string) => localize(h, locale);
  const titre = ville ? `${service.nom} à ${ville.nom}` : service.titre;
  return (
    <div className="tw mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label={t.breadcrumb} className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href={L("/sur-mesure")} className="hover:text-text">{t.crumb}</Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        {ville ? (
          <>
            <Link href={L(`/sur-mesure/${service.slug}`)} className="hover:text-text">{service.nom}</Link>
            <ChevronRight className="size-3.5" aria-hidden="true" />
            <span aria-current="page" className="text-text">{ville.nom}</span>
          </>
        ) : (
          <span aria-current="page" className="text-text">{service.nom}</span>
        )}
      </nav>

      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{titre}</h1>
          <p className="mt-4 max-w-prose text-lg text-muted">
            {ville ? `Skydev, basé à Wavre, réalise des sites internet pour les indépendants, commerçants et PME de ${ville.nom} et environs. ` : ""}
            {service.intro}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={L("/#contact")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors duration-150 hover:bg-accent-hover"><span className="inline-flex items-center gap-2 text-accent-foreground">{t.cta}<ArrowRight className="size-4" aria-hidden="true" /></span></Link>
            <a href="tel:+32477443988" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-strong bg-surface px-5 text-sm font-semibold transition-colors duration-150 hover:bg-surface-muted"><Phone className="size-4" aria-hidden="true" /><span>{t.phone}</span></a>
          </div>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {service.points.map((p) => (
              <li key={p.t} className="rounded-2xl border border-border bg-surface p-5">
                <p className="flex items-center gap-2 font-semibold"><Check className="size-4 text-accent" aria-hidden="true" />{p.t}</p>
                <p className="mt-1.5 text-sm text-muted">{p.d}</p>
              </li>
            ))}
          </ul>

          <section className="mt-12" aria-labelledby="etapes">
            <h2 id="etapes" className="text-xl font-semibold tracking-tight">{t.how}</h2>
            <ol className="mt-4 grid gap-4 sm:grid-cols-3">
              {t.steps.map((e, i) => (
                <li key={e.t} className="rounded-2xl border border-border bg-surface p-5">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-soft-foreground">{i + 1}</span>
                  <p className="mt-3 font-semibold">{e.t}</p>
                  <p className="mt-1 text-sm text-muted">{e.d}</p>
                </li>
              ))}
            </ol>
          </section>

          <DirectoryFaq items={service.faq} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm text-muted">{t.price}</p>
            <p className="mt-1 text-xl font-semibold">{service.prix}</p>
            <p className="mt-1 text-sm text-muted">{t.priceNote}</p>
            <div className="mt-4 space-y-2 text-sm">
              <a href="tel:+32477443988" className="flex items-center gap-2 hover:text-accent"><Phone className="size-4" aria-hidden="true" />{t.phone}</a>
              <a href="mailto:info@skydev.be" className="flex items-center gap-2 hover:text-accent"><Mail className="size-4" aria-hidden="true" />info@skydev.be</a>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="font-semibold">{t.toolsT}</p>
            <p className="mt-1 text-sm text-muted">{t.toolsD}</p>
            <Link href={L("/apps")} className="mt-3 inline-flex text-sm font-semibold hover:underline"><span className="inline-flex items-center gap-1 text-accent">{t.toolsCta}<ArrowRight className="size-3.5" aria-hidden="true" /></span></Link>
          </div>
        </aside>
      </div>

      <section className="mt-16" aria-labelledby="autres">
        <h2 id="autres" className="text-xl font-semibold tracking-tight">{t.others}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {customServicesL(locale).filter((s) => s.slug !== service.slug).map((s) => (
            <li key={s.slug}><Link href={L(`/sur-mesure/${s.slug}`)} className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:border-border-strong hover:text-text">{s.nom}</Link></li>
          ))}
        </ul>
        {service.villes ? (
          <>
            {/* Zones desservies : une phrase discrète (liens internes vers les pages par ville, utiles à Google). */}
            <p className="mt-10 max-w-prose text-sm text-muted">
              Skydev intervient à{" "}
              {SERVICE_CITIES.filter((c) => c.slug !== ville?.slug).map((c, i, all) => (
                <span key={c.slug}><Link href={`/sur-mesure/creation-site-internet/${c.slug}`} className="hover:text-text hover:underline">{c.nom}</Link>{i < all.length - 1 ? ", " : ""}</span>
              ))}
              {" "}et partout en Brabant wallon.
            </p>
          </>
        ) : null}
      </section>
    </div>
  );
}

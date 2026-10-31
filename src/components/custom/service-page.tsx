import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Mail, Phone } from "lucide-react";
import { DirectoryFaq } from "@/components/directory/directory-faq";
import { CUSTOM_SERVICES, SERVICE_CITIES, type CustomService } from "@/lib/custom-services";

/** Page d'un service sur mesure (et sa déclinaison par ville) : contenu, liens internes, contact. */
export function ServicePage({ service, ville, jsonLd }: { service: CustomService; ville?: { slug: string; nom: string }; jsonLd: object }) {
  const titre = ville ? `${service.nom} à ${ville.nom}` : service.titre;
  return (
    <div className="tw mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href="/sur-mesure" className="hover:text-text">Sur mesure</Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        {ville ? (
          <>
            <Link href={`/sur-mesure/${service.slug}`} className="hover:text-text">{service.nom}</Link>
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
            <Link href="/#contact" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors duration-150 hover:bg-accent-hover"><span className="inline-flex items-center gap-2 text-accent-foreground">Demander un devis gratuit<ArrowRight className="size-4" aria-hidden="true" /></span></Link>
            <a href="tel:+32477443988" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-strong bg-surface px-5 text-sm font-semibold transition-colors duration-150 hover:bg-surface-muted"><Phone className="size-4" aria-hidden="true" /><span>0477 44 39 88</span></a>
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
            <h2 id="etapes" className="text-xl font-semibold tracking-tight">Comment ça se passe</h2>
            <ol className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                { t: "On en parle", d: "15 minutes au téléphone ou en visio pour comprendre votre besoin." },
                { t: "Maquette et prix fixe", d: "Une estimation sous 24 h, puis une maquette avant de payer." },
                { t: "Mise en ligne", d: "Vous validez, c'est en ligne, et relié à Skydev si vous le voulez." },
              ].map((e, i) => (
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
            <p className="text-sm text-muted">Tarif</p>
            <p className="mt-1 text-xl font-semibold">{service.prix}</p>
            <p className="mt-1 text-sm text-muted">Prix fixe annoncé avant de commencer. Devis gratuit sous 24 h.</p>
            <div className="mt-4 space-y-2 text-sm">
              <a href="tel:+32477443988" className="flex items-center gap-2 hover:text-accent"><Phone className="size-4" aria-hidden="true" />0477 44 39 88</a>
              <a href="mailto:info@skydev.be" className="flex items-center gap-2 hover:text-accent"><Mail className="size-4" aria-hidden="true" />info@skydev.be</a>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="font-semibold">Et vos outils au quotidien ?</p>
            <p className="mt-1 text-sm text-muted">Rendez-vous, factures, caisse, stock, clients : la plateforme Skydev réunit tout, dès 29 € par mois.</p>
            <Link href="/" className="mt-3 inline-flex text-sm font-semibold hover:underline"><span className="inline-flex items-center gap-1 text-accent">Découvrir la plateforme<ArrowRight className="size-3.5" aria-hidden="true" /></span></Link>
          </div>
        </aside>
      </div>

      <section className="mt-16" aria-labelledby="autres">
        <h2 id="autres" className="text-xl font-semibold tracking-tight">Nos autres services sur mesure</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {CUSTOM_SERVICES.filter((s) => s.slug !== service.slug).map((s) => (
            <li key={s.slug}><Link href={`/sur-mesure/${s.slug}`} className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:border-border-strong hover:text-text">{s.nom}</Link></li>
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

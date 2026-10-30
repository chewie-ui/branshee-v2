import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { FeatureStatusPage } from "@/components/feature-status";
import { DirectoryGrid } from "@/components/directory/directory-card";
import { DirectoryFaq, faqFor } from "@/components/directory/directory-faq";
import { ProCallout } from "@/components/directory/directory-links";
import { DirectorySearch } from "@/components/directory/directory-search";
import { cap, knownMetiers, knownVilles, metierUrl, metierVilleUrl } from "@/lib/directory";
import { slugify } from "@/lib/slug";
import { currentBrand } from "@/server/brand";
import { metierVillePage } from "@/server/directory";
import { featureStatus } from "@/server/features";
import { siteUrl } from "@/server/site";

type P = Promise<{ metier: string; ville: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const p = await params;
  const d = await metierVillePage(p.metier, p.ville);
  if (!d) return {};
  const n = d.res.total;
  return {
    title: `${cap(d.metier.nom)} à ${d.ville.nom} : prendre rendez-vous en ligne`,
    description: n
      ? `${n} ${n > 1 ? d.metier.pluriel : d.metier.nom} à ${d.ville.nom} et alentours. Comparez, consultez les avis et réservez en ligne, 24 h/24, sans appeler.`
      : `Trouvez un ${d.metier.nom} à ${d.ville.nom} et réservez en ligne, 24 h/24.`,
    alternates: { canonical: metierVilleUrl(d.metier.slug, d.ville.slug) },
    // Page vide : utile au visiteur, mais pas à proposer dans Google tant qu'aucun pro n'y figure.
    robots: n ? undefined : { index: false, follow: true },
  };
}

export default async function MetierVillePage({ params }: { params: P }) {
  const gate = await featureStatus("search");
  if (gate.status !== "active") return <FeatureStatusPage status={gate.status} message={gate.message} />;
  const p = await params;
  const d = await metierVillePage(p.metier, p.ville);
  if (!d) notFound();
  const { metier, ville, res, cities, elsewhere, vocab } = d;
  const brand = await currentBrand();
  const base = siteUrl();
  const url = `${base}${metierVilleUrl(metier.slug, ville.slug)}`;
  const faq = faqFor(metier, ville);
  const autres = cities.filter((c) => slugify(c.city) !== ville.slug).map((c) => ({ slug: slugify(c.city), nom: c.city, n: c.n }));
  for (const v of knownVilles()) if (v.slug !== ville.slug && !autres.some((x) => x.slug === v.slug)) autres.push({ ...v, n: 0 });
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Annuaire", item: `${base}/annuaire` },
          { "@type": "ListItem", position: 2, name: cap(metier.pluriel), item: `${base}${metierUrl(metier.slug)}` },
          { "@type": "ListItem", position: 3, name: ville.nom, item: url },
        ],
      },
      ...(res.rows.length ? [{ "@type": "ItemList", name: `${cap(metier.pluriel)} à ${ville.nom}`, itemListElement: res.rows.map((b, i) => ({ "@type": "ListItem", position: i + 1, url: `${base}/${b.slug}`, name: b.name })) }] : []),
      { "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.r } })) },
    ],
  };

  return (
    <div className="tw mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href="/annuaire" className="hover:text-text">Annuaire</Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <Link href={metierUrl(metier.slug)} className="hover:text-text">{cap(metier.pluriel)}</Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span aria-current="page" className="text-text">{ville.nom}</span>
      </nav>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{cap(metier.nom)} à {ville.nom}</h1>
      <p className="mt-2 max-w-prose text-muted">
        {res.total
          ? `${res.total} ${res.total > 1 ? metier.pluriel : metier.nom} à ${ville.nom} et alentours. Consultez leurs prestations, leurs tarifs et leurs disponibilités, puis réservez en ligne en quelques clics.`
          : `Aucun ${metier.nom} de ${ville.nom} n'est encore inscrit sur l'annuaire.${elsewhere.length ? ` Voici d'autres ${metier.pluriel} qui prennent leurs rendez-vous en ligne.` : ""}`}
      </p>
      <div className="mt-6">
        <DirectorySearch q={cap(metier.nom)} ou={ville.nom} metiers={vocab.metierNames} villes={vocab.villeNames} />
      </div>

      <div className="mt-10">
        {res.rows.length ? (
          <DirectoryGrid rows={res.rows} />
        ) : elsewhere.length ? (
          <>
            <h2 className="mb-4 text-sm font-medium text-muted">{cap(metier.pluriel)} dans d&apos;autres villes</h2>
            <DirectoryGrid rows={elsewhere} />
          </>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="font-medium">Les premiers {metier.pluriel} arrivent bientôt.</p>
            <p className="mt-1 text-sm text-muted">Cherchez une autre ville ou un autre métier dans la barre ci-dessus.</p>
          </div>
        )}
      </div>

      <ProCallout brandName={brand.name} metier={metier} ville={ville} />
      <DirectoryFaq items={faq} />

      <section className="mt-16 grid gap-8 border-t border-border pt-10 sm:grid-cols-2" aria-label="Parcourir l'annuaire">
        <div>
          <h2 className="text-base font-semibold">{cap(metier.pluriel)} dans d&apos;autres villes</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {autres.slice(0, 30).map((v) => (
              <li key={v.slug}><Link href={metierVilleUrl(metier.slug, v.slug)} className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:border-border-strong hover:text-text">{cap(metier.nom)} à {v.nom}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold">Autres métiers à {ville.nom}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {knownMetiers().filter((m) => m.slug !== metier.slug).map((m) => (
              <li key={m.slug}><Link href={metierVilleUrl(m.slug, ville.slug)} className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:border-border-strong hover:text-text">{cap(m.nom)} à {ville.nom}</Link></li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

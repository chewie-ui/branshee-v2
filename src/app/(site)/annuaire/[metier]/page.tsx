import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { FeatureStatusPage } from "@/components/feature-status";
import { DirectoryGrid } from "@/components/directory/directory-card";
import { DirectoryFaq, faqFor } from "@/components/directory/directory-faq";
import { DirectoryLinks, ProCallout } from "@/components/directory/directory-links";
import { DirectorySearch } from "@/components/directory/directory-search";
import { cap, knownVilles, metierVilleUrl } from "@/lib/directory";
import { slugify } from "@/lib/slug";
import { currentBrand } from "@/server/brand";
import { metierPage } from "@/server/directory";
import { featureStatus } from "@/server/features";
import { siteUrl } from "@/server/site";

type P = Promise<{ metier: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const d = await metierPage((await params).metier);
  if (!d) return {};
  const t = `${cap(d.metier.pluriel)} en Belgique : réservez en ligne`;
  return {
    title: t,
    description: `Trouvez un ${d.metier.nom} près de chez vous et prenez rendez-vous en ligne, 24 h/24. ${d.res.total ? `${d.res.total} ${d.res.total > 1 ? d.metier.pluriel : d.metier.nom} sur l'annuaire.` : ""}`.trim(),
    alternates: { canonical: `/annuaire/${d.metier.slug}` },
    robots: d.res.total ? undefined : { index: false, follow: true },
  };
}

export default async function MetierPage({ params }: { params: P }) {
  const gate = await featureStatus("search");
  if (gate.status !== "active") return <FeatureStatusPage status={gate.status} message={gate.message} />;
  const d = await metierPage((await params).metier);
  if (!d) notFound();
  const { metier, res, cities, vocab } = d;
  const brand = await currentBrand();
  const villesLiens = [...cities.map((c) => ({ slug: slugify(c.city), nom: c.city, n: c.n }))];
  for (const v of knownVilles()) if (!villesLiens.some((x) => x.slug === v.slug)) villesLiens.push({ ...v, n: 0 });
  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Annuaire", item: `${base}/annuaire` }, { "@type": "ListItem", position: 2, name: cap(metier.pluriel), item: `${base}/annuaire/${metier.slug}` }] },
      { "@type": "FAQPage", mainEntity: faqFor(metier).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.r } })) },
    ],
  };

  return (
    <div className="tw mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-sm text-muted">
        <Link href="/annuaire" className="hover:text-text">Annuaire</Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span aria-current="page" className="text-text">{cap(metier.pluriel)}</span>
      </nav>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{cap(metier.pluriel)} : trouvez et réservez en ligne</h1>
      <p className="mt-2 max-w-prose text-muted">Choisissez votre ville pour voir les {metier.pluriel} près de chez vous, puis réservez directement le créneau qui vous convient, sans appeler.</p>
      <div className="mt-6">
        <DirectorySearch q={cap(metier.nom)} metiers={vocab.metierNames} villes={vocab.villeNames} />
      </div>

      <h2 className="mt-10 text-base font-semibold">Choisir une ville</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {villesLiens.slice(0, 40).map((v) => (
          <li key={v.slug}>
            <Link href={metierVilleUrl(metier.slug, v.slug)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:border-border-strong hover:text-text">
              {v.nom}
              {v.n ? <span className="rounded-full bg-accent-soft px-1.5 text-xs font-medium tabular-nums text-accent-soft-foreground">{v.n}</span> : null}
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-sm font-medium text-muted" role="status">{res.total ? `${res.total} ${res.total > 1 ? metier.pluriel : metier.nom} sur l'annuaire` : `Pas encore de ${metier.nom} sur l'annuaire`}</h2>
      {res.rows.length ? (
        <div className="mt-4"><DirectoryGrid rows={res.rows} /></div>
      ) : (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-10 text-center">
          <p className="font-medium">Les premiers {metier.pluriel} arrivent bientôt.</p>
          <p className="mt-1 text-sm text-muted">En attendant, cherchez par nom ou par prestation dans la barre ci-dessus.</p>
        </div>
      )}

      <ProCallout brandName={brand.name} metier={metier} />
      <DirectoryFaq items={faqFor(metier)} />
      <DirectoryLinks metier={metier} villes={knownVilles()} />
    </div>
  );
}

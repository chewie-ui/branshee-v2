import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Phone } from "lucide-react";
import { CUSTOM_SERVICES, SERVICE_CITIES } from "@/lib/custom-services";
import { currentBrand } from "@/server/brand";

export const metadata: Metadata = {
  title: "Sites, apps et logiciels sur mesure — Wavre, Brabant wallon",
  description: "Création de site internet, boutique en ligne, application web et mobile, SaaS, CRM et automatisations pour indépendants et PME. Basé à Wavre, devis gratuit sous 24 h.",
  alternates: { canonical: "/sur-mesure" },
};

export default async function SurMesureHub() {
  if ((await currentBrand()).id !== "skydev") notFound();
  return (
    <div className="tw mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Sites, apps et logiciels sur mesure</h1>
      <p className="mt-4 max-w-prose text-lg text-muted">Si vous pouvez le décrire, on peut le construire : un site qui vous amène des clients, une boutique, une app, un logiciel pour votre métier. Basé à Wavre, un seul interlocuteur, un prix fixe annoncé avant de commencer.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/#contact" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors duration-150 hover:bg-accent-hover"><span className="inline-flex items-center gap-2 text-accent-foreground">Demander un devis gratuit<ArrowRight className="size-4" aria-hidden="true" /></span></Link>
        <a href="tel:+32477443988" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-strong bg-surface px-5 text-sm font-semibold transition-colors duration-150 hover:bg-surface-muted"><Phone className="size-4" aria-hidden="true" /><span>0477 44 39 88</span></a>
      </div>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CUSTOM_SERVICES.map((s) => (
          <li key={s.slug}>
            <Link href={`/sur-mesure/${s.slug}`} className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition-colors duration-150 hover:border-border-strong">
              <span className="font-semibold">{s.nom}</span>
              <span className="mt-1.5 flex-1 text-sm text-muted">{s.description}</span>
              <span className="mt-3 text-sm font-medium"><span className="text-accent">{s.prix}</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="mt-12 text-base font-semibold">Création de site internet près de chez vous</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {SERVICE_CITIES.map((c) => (
          <li key={c.slug}><Link href={`/sur-mesure/creation-site-internet/${c.slug}`} className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:border-border-strong hover:text-text">{c.nom}</Link></li>
        ))}
      </ul>
    </div>
  );
}

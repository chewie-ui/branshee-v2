import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServicePage } from "@/components/custom/service-page";
import { customService, serviceCity } from "@/lib/custom-services";
import { currentBrand } from "@/server/brand";
import { siteUrl } from "@/server/site";

type P = Promise<{ service: string; ville: string }>;

async function resolve(params: P) {
  const { service, ville } = await params;
  const s = customService(service);
  const v = serviceCity(ville);
  return s?.villes && v ? { s, v } : null;
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return {};
  return {
    title: `${r.s.nom} à ${r.v.nom}`,
    description: `${r.s.nom} à ${r.v.nom} : ${r.s.description}`,
    alternates: { canonical: `/sur-mesure/${r.s.slug}/${r.v.slug}` },
  };
}

export default async function ServiceVilleRoute({ params }: { params: P }) {
  const r = await resolve(params);
  if (!r || (await currentBrand()).id !== "skydev") notFound();
  const { s, v } = r;
  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Sur mesure", item: `${base}/sur-mesure` }, { "@type": "ListItem", position: 2, name: s.nom, item: `${base}/sur-mesure/${s.slug}` }, { "@type": "ListItem", position: 3, name: v.nom, item: `${base}/sur-mesure/${s.slug}/${v.slug}` }] },
      { "@type": "Service", name: `${s.nom} à ${v.nom}`, description: s.description, areaServed: v.nom, provider: { "@type": "LocalBusiness", name: "Skydev", url: base, telephone: "+32477443988", address: { "@type": "PostalAddress", addressLocality: "Wavre", addressCountry: "BE" } } },
      { "@type": "FAQPage", mainEntity: s.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.r } })) },
    ],
  };
  return <ServicePage service={s} ville={v} jsonLd={jsonLd} />;
}

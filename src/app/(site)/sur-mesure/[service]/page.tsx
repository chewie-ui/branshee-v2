import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServicePage } from "@/components/custom/service-page";
import { customService } from "@/lib/custom-services";
import { currentBrand } from "@/server/brand";
import { siteUrl } from "@/server/site";

type P = Promise<{ service: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const s = customService((await params).service);
  if (!s) return {};
  return { title: `${s.titre} — Wavre, Brabant wallon`, description: s.description, alternates: { canonical: `/sur-mesure/${s.slug}` } };
}

export default async function ServiceRoute({ params }: { params: P }) {
  const s = customService((await params).service);
  if (!s || (await currentBrand()).id !== "skydev") notFound();
  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Sur mesure", item: `${base}/sur-mesure` }, { "@type": "ListItem", position: 2, name: s.nom, item: `${base}/sur-mesure/${s.slug}` }] },
      { "@type": "Service", name: s.titre, description: s.description, areaServed: "Brabant wallon, Bruxelles, Belgique", provider: { "@type": "LocalBusiness", name: "Skydev", url: base, telephone: "+32477443988", address: { "@type": "PostalAddress", addressLocality: "Wavre", addressCountry: "BE" } } },
      { "@type": "FAQPage", mainEntity: s.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.r } })) },
    ],
  };
  return <ServicePage service={s} jsonLd={jsonLd} />;
}

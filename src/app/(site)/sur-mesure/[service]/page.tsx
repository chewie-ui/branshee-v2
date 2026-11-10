import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServicePage } from "@/components/custom/service-page";
import { customServiceBySlugAny, customServiceL } from "@/lib/custom-services-i18n";
import { localize } from "@/lib/site-locale";
import { currentBrand } from "@/server/brand";
import { siteUrl } from "@/server/site";
import { siteLocale } from "@/server/site-locale";

type P = Promise<{ service: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const base = customServiceBySlugAny((await params).service);
  if (!base) return {};
  const l = await siteLocale();
  const s = customServiceL(base, l);
  return {
    title: l === "fr" ? `${s.titre} — Wavre, Brabant wallon` : s.titre,
    description: s.description,
    alternates: { canonical: localize(`/sur-mesure/${s.slug}`, l), languages: { fr: `/sur-mesure/${base.slug}`, en: localize(`/sur-mesure/${customServiceL(base, "en").slug}`, "en") } },
  };
}

export default async function ServiceRoute({ params }: { params: P }) {
  const base0 = customServiceBySlugAny((await params).service);
  if (!base0 || (await currentBrand()).id !== "skydev") notFound();
  const l = await siteLocale();
  const s = customServiceL(base0, l);
  const base = siteUrl();
  const url = `${base}${localize(`/sur-mesure/${s.slug}`, l)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: l === "fr" ? "Sur mesure" : "Custom work", item: `${base}${localize("/sur-mesure", l)}` }, { "@type": "ListItem", position: 2, name: s.nom, item: url }] },
      { "@type": "Service", name: s.titre, description: s.description, areaServed: l === "fr" ? "Brabant wallon, Bruxelles, Belgique" : "Worldwide", provider: { "@type": "LocalBusiness", name: "Skydev", url: base, telephone: "+32477443988", address: { "@type": "PostalAddress", addressLocality: "Wavre", addressCountry: "BE" } } },
      { "@type": "FAQPage", mainEntity: s.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.r } })) },
    ],
  };
  return <ServicePage service={s} jsonLd={jsonLd} locale={l} />;
}

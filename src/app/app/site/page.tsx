import type { Metadata } from "next";
import { Check, LayoutTemplate } from "lucide-react";
import { UpgradeNotice } from "@/components/app/upgrade-notice";
import { SiteEditor } from "@/components/site-editor/site-editor";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { SiteSection } from "@/lib/site-templates";
import { requireContext } from "@/server/context";
import { businessHas } from "@/server/plan";
import { getOrCreateSite } from "@/server/site-builder";

export const metadata: Metadata = { title: "Mon site" };

export default async function MySitePage() {
  const ctx = await requireContext("customization.manage");
  if (!(await businessHas(ctx.business.id, "mySite"))) {
    return (
      <>
        <PageHeader title="Mon site" description="Un site vitrine à votre image, relié à vos réservations." />
        <UpgradeNotice feature="Mon site" required="pro_plus">Créez un site vitrine complet en quelques minutes, à partir de modèles prêts à l&apos;emploi, publié à l&apos;adresse de votre page.</UpgradeNotice>
        <Card className="mt-6 p-6">
          <LayoutTemplate className="size-8 text-accent" aria-hidden="true" />
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {["Modèles rédigés et prêts à publier", "Sections : accueil, prestations, réservation intégrée, à propos, galerie, avis, FAQ, contact", "Couleurs, polices, logo et réseaux sociaux", "Formulaire de contact et référencement Google", "Nom de domaine personnalisé", "Compteur de visites"].map((f) => (
              <li key={f} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />{f}</li>
            ))}
          </ul>
        </Card>
      </>
    );
  }
  const site = await getOrCreateSite(ctx.business.id);
  const base = (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");
  return (
    <>
      <PageHeader title="Mon site" description="Publié, il remplace votre page de réservation à la même adresse ; la réservation y est intégrée." />
      <SiteEditor
        initial={{
          sections: site.sections as SiteSection[],
          theme: { ...site.theme, headingFont: site.theme.headingFont ?? "" },
          seo: { title: site.seo.title ?? "", description: site.seo.description ?? "" },
          social: site.social,
          logoUrl: site.logoUrl ?? "",
          customDomain: site.customDomain ?? "",
        }}
        published={!!site.publishedAt}
        publicUrl={site.customDomain ? `https://${site.customDomain}` : `${base}/${ctx.business.slug}`}
        visits={site.visitCount}
        appHost={new URL(base).hostname}
      />
    </>
  );
}

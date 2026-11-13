import { currentBrand } from "@/server/brand";
import { contactSettingsById } from "@/server/contact-settings";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { MiniSite } from "@/components/site/mini-site";
import type { SiteSection } from "@/lib/site-templates";
import { requireContext } from "@/server/context";
import { businessHas } from "@/server/plan";
import { siteContent } from "@/server/site-builder";
import { getSiteDraft } from "@/server/site-preview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aperçu du site", robots: { index: false } };

/** Aperçu du site tel qu'enregistré (affiché dans l'éditeur, même non publié). */
export default async function SitePreview({ searchParams }: { searchParams: Promise<{ brouillon?: string }> }) {
  const ctx = await requireContext("customization.manage");
  if (!(await businessHas(ctx.business.id, "mySite"))) notFound();
  const [site] = await db.select().from(sites).where(eq(sites.businessId, ctx.business.id));
  if (!site) notFound();
  // Éditeur : aperçu en direct du brouillon non enregistré (sinon : le site enregistré).
  const draft = (await searchParams).brouillon ? getSiteDraft(ctx.business.id) : null;
  const noBranding = await businessHas(ctx.business.id, "noBranding");
  return <MiniSite preview site={draft ? { sections: draft.sections, theme: draft.theme as typeof site.theme, logoUrl: draft.logoUrl, social: draft.social as typeof site.social } : { sections: site.sections as SiteSection[], theme: site.theme, logoUrl: site.logoUrl, social: site.social }} business={{ id: ctx.business.id, name: ctx.business.name, slug: ctx.business.slug, noBranding , poweredBy: (await currentBrand()).id === "skydev" ? { name: "Skydev", url: "https://skydev.be" } : undefined, contact: (await contactSettingsById(ctx.business.id)) ?? undefined }} content={await siteContent(ctx.business.id)} />;
}

import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingPageSettings } from "@/db/schema";
import { PageTabs } from "@/components/booking-page/page-tabs";
import { EmbedBuilder, QrCard, SlugCard } from "@/components/booking-page/share-panel";
import { PageHeader } from "@/components/ui/page-header";
import { resolveTheme } from "@/lib/booking-theme";
import { requireContext } from "@/server/context";
import { publicPagePath } from "@/server/brand";
import { businessHas } from "@/server/plan";
import { UpgradeNotice } from "@/components/app/upgrade-notice";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Partager · Page de réservation");

export default async function SharePage() {
  const t = await appT();
  const ctx = await requireContext("customization.manage");
  const [page] = await db.select({ theme: bookingPageSettings.theme, embed: bookingPageSettings.embed }).from(bookingPageSettings).where(eq(bookingPageSettings.businessId, ctx.business.id));
  const origin = (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");
  const path = await publicPagePath(ctx.business.slug);
  const prefix = path.slice(0, -ctx.business.slug.length - 1);
  return (
    <>
      <PageHeader title={t("Page de réservation")} description={t("Partagez votre lien, imprimez votre QR code ou ajoutez le calendrier à votre site.")} />
      <PageTabs />
      <div className="mx-auto max-w-3xl space-y-6">
        {!(await businessHas(ctx.business.id, "customUrl")) ? <UpgradeNotice feature={t("Adresse personnalisée")} required="pro_plus">{t("Incluse dans Pro+, ou en option à 5 €/mois avec Pro.")}</UpgradeNotice> : null}
        <SlugCard origin={origin} prefix={prefix} slug={ctx.business.slug} />
        <QrCard url={`${origin}${path}`} name={ctx.business.name} />
        <EmbedBuilder origin={origin} prefix={prefix} slug={ctx.business.slug} accent={resolveTheme(page?.theme).accentColor} initial={{ title: page?.embed.title ?? "", fontUrl: page?.embed.fontUrl ?? "", fontFamily: page?.embed.fontFamily ?? "" }} />
      </div>
    </>
  );
}

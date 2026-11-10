import { appPagePath } from "@/lib/brand";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingPageSettings } from "@/db/schema";
import { PageTabs } from "@/components/booking-page/page-tabs";
import { ThemeEditor } from "@/components/booking-page/theme-editor";
import { PageHeader } from "@/components/ui/page-header";
import { resolveTheme } from "@/lib/booking-theme";
import { requireContext } from "@/server/context";
import { businessHas } from "@/server/plan";
import { UpgradeNotice } from "@/components/app/upgrade-notice";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Apparence · Page de réservation");

export default async function AppearancePage() {
  const t = await appT();
  const ctx = await requireContext("customization.manage");
  const locked = !(await businessHas(ctx.business.id, "customization"));
  const [page] = await db.select({ theme: bookingPageSettings.theme }).from(bookingPageSettings).where(eq(bookingPageSettings.businessId, ctx.business.id));
  return (
    <>
      <PageHeader title={t("Page de réservation")} description={t("Couleurs, police et style de votre page : l'aperçu se met à jour en direct.")} />
      <PageTabs />
      {locked ? <div className="mb-4"><UpgradeNotice feature={t("Personnalisation de la page")} required="pro">{t("Essayez librement : l'aperçu montre le résultat. L'enregistrement est disponible à partir du forfait Pro.")}</UpgradeNotice></div> : null}
      <ThemeEditor initial={resolveTheme(page?.theme)} previewUrl={`${appPagePath(ctx.business.slug)}?apercu=1`} locked={locked} />
    </>
  );
}

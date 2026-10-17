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

export const metadata: Metadata = { title: "Apparence · Page de réservation" };

export default async function AppearancePage() {
  const ctx = await requireContext("customization.manage");
  const [page] = await db.select({ theme: bookingPageSettings.theme }).from(bookingPageSettings).where(eq(bookingPageSettings.businessId, ctx.business.id));
  return (
    <>
      <PageHeader title="Page de réservation" description="Couleurs, police et style de votre page : l'aperçu se met à jour en direct." />
      <PageTabs />
      {!(await businessHas(ctx.business.id, "customization")) ? <div className="mb-4"><UpgradeNotice feature="Personnalisation de la page" required="pro">Essayez librement : l&apos;aperçu montre le résultat. L&apos;enregistrement est disponible à partir du forfait Pro.</UpgradeNotice></div> : null}
      <ThemeEditor initial={resolveTheme(page?.theme)} previewUrl={`/${ctx.business.slug}?apercu=1`} />
    </>
  );
}

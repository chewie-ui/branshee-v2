import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingPageSettings } from "@/db/schema";
import { PageTabs } from "@/components/booking-page/page-tabs";
import { EmbedBuilder, QrCard, SlugCard } from "@/components/booking-page/share-panel";
import { PageHeader } from "@/components/ui/page-header";
import { resolveTheme } from "@/lib/booking-theme";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Partager · Page de réservation" };

export default async function SharePage() {
  const ctx = await requireContext("customization.manage");
  const [page] = await db.select({ theme: bookingPageSettings.theme, embed: bookingPageSettings.embed }).from(bookingPageSettings).where(eq(bookingPageSettings.businessId, ctx.business.id));
  const origin = (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");
  return (
    <>
      <PageHeader title="Page de réservation" description="Partagez votre lien, imprimez votre QR code ou ajoutez le calendrier à votre site." />
      <PageTabs />
      <div className="mx-auto max-w-3xl space-y-6">
        <SlugCard origin={origin} slug={ctx.business.slug} />
        <QrCard url={`${origin}/${ctx.business.slug}`} name={ctx.business.name} />
        <EmbedBuilder origin={origin} slug={ctx.business.slug} accent={resolveTheme(page?.theme).accentColor} initial={{ title: page?.embed.title ?? "", fontUrl: page?.embed.fontUrl ?? "", fontFamily: page?.embed.fontFamily ?? "" }} />
      </div>
    </>
  );
}

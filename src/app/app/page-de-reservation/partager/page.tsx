import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingPageSettings } from "@/db/schema";
import { PageTabs } from "@/components/booking-page/page-tabs";
import { EmbedBuilder, QrCard, SlugCard } from "@/components/booking-page/share-panel";
import { PageHeader } from "@/components/ui/page-header";
import { resolveTheme } from "@/lib/booking-theme";
import { requireContext } from "@/server/context";
import { currentBrand, publicPagePath } from "@/server/brand";
import { Card, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Globe2 } from "lucide-react";
import { businessHas, hasProSubdomain } from "@/server/plan";
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
  const skydev = (await currentBrand()).id === "skydev";
  const entitled = await businessHas(ctx.business.id, "customUrl");
  const subdomain = skydev && (await hasProSubdomain(ctx.business.id));
  return (
    <>
      <PageHeader title={t("Page de réservation")} description={t("Partagez votre lien, imprimez votre QR code ou ajoutez le calendrier à votre site.")} />
      <PageTabs />
      <div className="mx-auto max-w-3xl space-y-6">
        {skydev && !subdomain ? (
          <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent-soft p-4 sm:flex-row sm:items-center">
            <Globe2 className="size-5 shrink-0 text-accent" aria-hidden="true" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-accent-soft-foreground">{t("Adresse courte")} : {ctx.business.slug}.skydev.be</p>
              <p className="text-muted">{t("En option à 6 €/mois (Réglages › Abonnement) : votre page sur votre-nom.skydev.be, activée tout de suite.")}</p>
            </div>
            <ButtonLink href="/app/reglages/abonnement" size="sm">{t("Activer")}</ButtonLink>
          </div>
        ) : null}
        {!skydev && !entitled ? <UpgradeNotice feature={t("Adresse personnalisée")} required="pro_plus">{t("Incluse dans Pro+, ou en option à 5 €/mois avec Pro.")}</UpgradeNotice> : null}
        <SlugCard origin={origin} prefix={prefix} slug={ctx.business.slug} />
        {subdomain ? (
          <Card>
            <CardHeader title={t("Votre adresse courte")} description={t("Votre page est aussi en ligne à cette adresse. Elle suit l'adresse choisie ci-dessus.")} />
            <div className="p-5">
              <a href={`https://${ctx.business.slug}.skydev.be`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface-muted px-4 font-medium hover:bg-surface"><Globe2 className="size-4 text-accent" aria-hidden="true" />{ctx.business.slug}.skydev.be</a>
            </div>
          </Card>
        ) : null}
        <QrCard url={`${origin}${path}`} name={ctx.business.name} />
        <EmbedBuilder origin={origin} prefix={prefix} slug={ctx.business.slug} accent={resolveTheme(page?.theme).accentColor} initial={{ title: page?.embed.title ?? "", fontUrl: page?.embed.fontUrl ?? "", fontFamily: page?.embed.fontFamily ?? "" }} />
      </div>
    </>
  );
}

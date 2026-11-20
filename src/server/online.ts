import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, shopSettings, sites } from "@/db/schema";
import { visibleApps } from "@/server/apps";
import { businessHas } from "@/server/plan";
import type { AppContext } from "@/server/context";

export type OnlineKind = "booking" | "site" | "shop";
export type OnlineItem = { kind: OnlineKind; label: string; on: boolean; hint: string; settingsHref: string };

/**
 * Pages publiques de l'établissement qu'on peut couper d'un clic : page de réservation, site web, boutique.
 * Seules les apps ajoutées à l'établissement apparaissent.
 */
export async function onlineItems(ctx: AppContext): Promise<OnlineItem[]> {
  const ids = new Set((await visibleApps(ctx)).map((a) => a.id as string));
  const [b] = await db.select({ pausedAt: businesses.pausedAt }).from(businesses).where(eq(businesses.id, ctx.business.id));
  const items: OnlineItem[] = [
    { kind: "booking", label: "Réservation en ligne", on: !b?.pausedAt, hint: "Coupée : votre page reste visible, mais plus personne ne peut réserver en ligne.", settingsHref: "/app/page-de-reservation" },
  ];
  if (ids.has("site") && (await businessHas(ctx.business.id, "mySite"))) {
    const [s] = await db.select({ publishedAt: sites.publishedAt }).from(sites).where(eq(sites.businessId, ctx.business.id));
    if (s) items.push({ kind: "site", label: "Site web", on: !!s.publishedAt, hint: "Coupé : votre page de réservation s'affiche à la place.", settingsHref: "/app/site" });
  }
  if (ids.has("boutique")) {
    const [sh] = await db.select({ enabled: shopSettings.enabled }).from(shopSettings).where(eq(shopSettings.businessId, ctx.business.id));
    items.push({ kind: "shop", label: "Boutique en ligne", on: !!sh?.enabled, hint: "Fermée : vos clients voient « Boutique fermée » et ne peuvent plus commander.", settingsHref: "/app/boutique/reglages" });
  }
  return items;
}

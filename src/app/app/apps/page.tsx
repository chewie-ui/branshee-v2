import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessModules } from "@/db/schema";
import { AppStore } from "@/components/apps/app-store";
import { appById } from "@/lib/apps";
import { METIERS, metierForType, storeAppById } from "@/lib/app-store";
import { APP_REACH, appText } from "@/lib/apps-i18n";
import { metierL, storeL } from "@/lib/app-store-i18n";
import { countryName } from "@/lib/countries";
import { visibleApps } from "@/server/apps";
import { requireContext } from "@/server/context";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("App store");

/**
 * App store de l'espace pro : l'entreprise prend les apps dont elle a besoin (elles arrivent sur l'accueil),
 * retire les autres, et peut demander une modif d'app ou une app créée de zéro (Sur mesure).
 */
export default async function Page() {
  const ctx = await requireContext(undefined, { allowLocked: true });
  const canEdit = ctx.member.isOwner || ctx.can("settings.manage");
  const locale = ctx.user.locale ?? "fr";
  const [apps, mods] = await Promise.all([visibleApps(ctx, { withUnavailable: true }), db.select({ key: businessModules.moduleKey }).from(businessModules).where(eq(businessModules.businessId, ctx.business.id))]);
  const metier = metierForType(ctx.business.businessType);
  const items = apps
    .filter((a) => a.id !== "reglages" && a.id !== "employes" && a.billing !== "quote")
    .map((a) => {
      const s0 = storeAppById(a.id);
      const s = s0 ? storeL(s0, locale) : null;
      return { id: a.id, name: a.name, tagline: a.tagline, icon: a.icon, href: a.href, billing: a.billing, category: a.category, installed: a.pinned && a.available, features: appText(appById(a.id), locale).features, tags: s?.tags ?? [], slug: s0?.slug ?? null, metiers: METIERS.filter((m) => m.apps.some((x) => x.id === a.id)).map((m) => m.slug), available: a.available, reach: APP_REACH[a.id] };
    })
    // Apps indisponibles dans le pays : en fin de liste.
    .sort((x, y) => Number(y.available) - Number(x.available));
  return (
    <AppStore
      items={items}
      canEdit={canEdit}
      activeAddons={mods.map((m) => m.key.replace(/_/g, "-"))}
      metiers={METIERS.map((m) => ({ slug: m.slug, nom: metierL(m, locale).nom }))}
      mine={metier ? { slug: metier.slug, nom: metierL(metier, locale).nom } : null}
      country={{ name: countryName(ctx.business.countryCode ?? "BE", locale), canChange: ctx.can("business.manage") }}
    />
  );
}

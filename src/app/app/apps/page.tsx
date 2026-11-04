import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessModules } from "@/db/schema";
import { AppStore } from "@/components/apps/app-store";
import { appById } from "@/lib/apps";
import { METIERS, metierForType, storeAppById } from "@/lib/app-store";
import { visibleApps } from "@/server/apps";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "App store" };

/**
 * App store de l'espace pro : l'entreprise prend les apps dont elle a besoin (elles arrivent sur l'accueil),
 * retire les autres, et peut demander une modif d'app ou une app créée de zéro (Sur mesure).
 */
export default async function Page() {
  const ctx = await requireContext(undefined, { allowLocked: true });
  const canEdit = ctx.member.isOwner || ctx.can("settings.manage");
  const [apps, mods] = await Promise.all([visibleApps(ctx), db.select({ key: businessModules.moduleKey }).from(businessModules).where(eq(businessModules.businessId, ctx.business.id))]);
  const metier = metierForType(ctx.business.businessType);
  const items = apps
    .filter((a) => a.id !== "reglages" && a.id !== "employes" && a.billing !== "quote")
    .map((a) => {
      const s = storeAppById(a.id);
      return { id: a.id, name: a.name, tagline: a.tagline, icon: a.icon, href: a.href, billing: a.billing, category: a.category, installed: a.pinned, features: appById(a.id).features, tags: s?.tags ?? [], slug: s?.slug ?? null, metiers: METIERS.filter((m) => m.apps.some((x) => x.id === a.id)).map((m) => m.slug) };
    });
  return (
    <AppStore
      items={items}
      canEdit={canEdit}
      activeAddons={mods.map((m) => m.key.replace(/_/g, "-"))}
      metiers={METIERS.map((m) => ({ slug: m.slug, nom: m.nom }))}
      mine={metier ? { slug: metier.slug, nom: metier.nom } : null}
    />
  );
}

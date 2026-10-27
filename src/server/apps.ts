import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { APPS, type AppIcon, type AppNavItem, type SkyApp } from "@/lib/apps";
import { clientWord } from "@/lib/terminology";
import type { AppContext } from "@/server/context";
import { hiddenNavHrefs } from "@/server/features";

export type VisibleApp = { id: SkyApp["id"]; name: string; icon: AppIcon; href: string; nav: AppNavItem[]; match?: string[]; status: SkyApp["status"]; billing: SkyApp["billing"]; tagline: string; category: SkyApp["category"]; pinned: boolean };

/**
 * Apps visibles pour ce membre : chaque app ne garde que les menus permis (permissions, menus masqués
 * par l'équipe) ; une app sans menu accessible disparaît. « Clients » devient « Patients » en santé.
 */
export async function visibleApps(ctx: AppContext, opts: { pending?: number } = {}): Promise<VisibleApp[]> {
  const [hidden, [biz]] = await Promise.all([hiddenNavHrefs(), db.select({ o: businesses.onboarding }).from(businesses).where(eq(businesses.id, ctx.business.id))]);
  // Apps rangées hors de l'accueil (questionnaire de départ ou choix du responsable).
  const off = new Set(biz?.o.hiddenApps ?? []);
  const clients = clientWord(ctx.business.businessType, { plural: true, capitalize: true });
  return APPS.map((a) => ({
    id: a.id,
    name: a.id === "clients" ? clients : a.name,
    icon: a.icon,
    match: a.match,
    status: a.status,
    billing: a.billing,
    tagline: a.tagline,
    category: a.category,
    pinned: a.id === "reglages" || !off.has(a.id),
    href: a.href,
    nav: a.nav
      .filter((i) => !i.permission || ctx.can(i.permission))
      .filter((i) => !hidden.has(i.href))
      .filter((i) => i.href !== "/app/demandes" || (opts.pending ?? 0) > 0)
      .map((i) => (i.href === "/app/clients" ? { ...i, label: clients } : i)),
  }))
    .filter((a) => a.nav.length > 0)
    .map((a) => ({ ...a, href: a.nav.some((n) => n.href === a.href) ? a.href : a.nav[0]!.href }));
}

/** Le questionnaire de départ a-t-il été rempli pour cet établissement ? */
export async function appsSetupDone(businessId: string) {
  const [b] = await db.select({ o: businesses.onboarding }).from(businesses).where(eq(businesses.id, businessId));
  return !!b?.o.appsSetupAt;
}

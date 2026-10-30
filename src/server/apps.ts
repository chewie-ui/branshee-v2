import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, members } from "@/db/schema";
import { APPS, type AppIcon, type AppNavItem, type SkyApp } from "@/lib/apps";
import { clientWord } from "@/lib/terminology";
import type { AppContext } from "@/server/context";
import { hiddenNavHrefs } from "@/server/features";

export type VisibleApp = { id: SkyApp["id"]; name: string; icon: AppIcon; href: string; nav: AppNavItem[]; match?: string[]; status: SkyApp["status"]; billing: SkyApp["billing"]; tagline: string; category: SkyApp["category"]; pinned: boolean; fav: boolean };

/**
 * Apps visibles pour ce membre : chaque app ne garde que les menus permis (permissions, menus masqués
 * par l'équipe) ; une app sans menu accessible disparaît. « Clients » devient « Patients » en santé.
 */
export async function visibleApps(ctx: AppContext, opts: { pending?: number } = {}): Promise<VisibleApp[]> {
  const [hidden, [biz], [me]] = await Promise.all([hiddenNavHrefs(), db.select({ o: businesses.onboarding }).from(businesses).where(eq(businesses.id, ctx.business.id)), db.select({ p: members.prefs }).from(members).where(eq(members.id, ctx.member.id))]);
  // Apps favorites de ce membre : en tête, dans l'ordre où il les a épinglées.
  const favs = (me?.p.favApps ?? []).filter((x): x is string => typeof x === "string");
  // Apps rangées hors de l'accueil (questionnaire de départ ou choix du responsable).
  const off = new Set(biz?.o.hiddenApps ?? []);
  const clients = clientWord(ctx.business.businessType, { plural: true, capitalize: true });
  return APPS.filter((a) => ctx.canApp(a.id)).map((a) => ({
    id: a.id,
    name: a.id === "clients" ? clients : a.name,
    icon: a.icon,
    match: a.match,
    status: a.status,
    billing: a.billing,
    tagline: a.tagline,
    category: a.category,
    // Retirée de l'accueil par le responsable : elle n'y revient pas, même épinglée par un membre.
    pinned: a.id === "reglages" || !off.has(a.id),
    fav: favs.includes(a.id),
    href: a.href,
    nav: a.nav
      .filter((i) => !i.permission || ctx.can(i.permission))
      .filter((i) => !hidden.has(i.href))
      .filter((i) => i.href !== "/app/demandes" || (opts.pending ?? 0) > 0)
      .map((i) => (i.href === "/app/clients" ? { ...i, label: clients } : i)),
  }))
    .filter((a) => a.nav.length > 0)
    .map((a) => ({ ...a, href: a.nav.some((n) => n.href === a.href) ? a.href : a.nav[0]!.href }))
    .sort((x, y) => (x.fav === y.fav ? (x.fav ? favs.indexOf(x.id) - favs.indexOf(y.id) : 0) : x.fav ? -1 : 1));
}

/** Le questionnaire de départ a-t-il été rempli pour cet établissement ? */
export async function appsSetupDone(businessId: string) {
  const [b] = await db.select({ o: businesses.onboarding }).from(businesses).where(eq(businesses.id, businessId));
  return !!b?.o.appsSetupAt;
}

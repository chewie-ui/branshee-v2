"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { activeNavHref, appForPath, type AppIcon as AppIconName, type AppNavItem } from "@/lib/apps";
import { Sidebar } from "@/components/app/sidebar";
import type { NavItem } from "@/lib/navigation";

export type ShellApp = { id: string; name: string; icon: AppIconName; href: string; nav: AppNavItem[]; match?: string[]; pinned?: boolean };
type Biz = { id: string; name: string; businessType: string | null };

/** Barre latérale Branshee, gardée telle quelle dans l'app RDV. */
export type RdvSidebar = { groups: { label: string | null; items: NavItem[] }[]; footer: NavItem[] };

const starts = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + "/");

/**
 * Espace client Skydev : la même barre latérale que Branshee pour toutes les apps.
 * En tête « Toutes les apps », puis les menus de l'app ouverte. Sur l'accueil (/app), la liste des apps
 * de l'entreprise. L'app RDV garde sa barre Branshee à l'identique.
 */
export function SkydevShell({ apps, rdv, business, businesses, user, badges, children }: { apps: ShellApp[]; rdv: RdvSidebar; business: Biz; businesses: Biz[]; user: { name: string; email: string; avatarUrl: string | null }; badges: Record<string, number>; children: ReactNode }) {
  const pathname = usePathname();
  const found = pathname === "/app" ? null : appForPath(apps, pathname);
  // L'app RDV garde l'interface Branshee : ses liens (Patients, Équipe, Site web…) restent dans RDV
  // quand on les ouvre depuis RDV, au lieu de basculer vers l'app correspondante.
  const [last, setLast] = useState<string | null>(found?.id ?? null);
  const inRdvSidebar = [...rdv.groups.flatMap((g) => g.items), ...rdv.footer].some((i) => i.href !== "/app" && starts(pathname, i.href));
  const app = last === "rdv" && found?.id !== "rdv" && inRdvSidebar ? (apps.find((a) => a.id === "rdv") ?? found) : found;
  if ((app?.id ?? null) !== last) setLast(app?.id ?? null);

  const home: NavItem = { href: "/app", label: "Toutes les apps", icon: "apps" };
  const settings = new Set(["reglages", "employes"]);
  const groups =
    app?.id === "rdv"
      ? rdv.groups
      : app
        ? [{ label: null, items: [home] }, { label: app.name, items: app.nav.map((n) => ({ ...n, label: n.soon ? `${n.label} · bientôt` : n.label })) }]
        : [{ label: null, items: [home] }, { label: "Vos apps", items: apps.filter((a) => a.pinned !== false && !settings.has(a.id)).map((a) => ({ href: a.href, label: a.name, icon: a.icon })) }];
  const activeHref = app && app.id !== "rdv" ? activeNavHref(app.nav, pathname) : undefined;

  return (
    <div className="min-h-dvh">
      <Sidebar brand="skydev" groups={groups} footer={rdv.footer} business={business} businesses={businesses} user={user} pendingCount={badges["/app/demandes"] ?? 0} supportUnread={badges["/app/aide"] ?? 0} activeHref={activeHref} />
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}

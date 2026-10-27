"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type AdminBadges = { support: number; reports: number; jobs: number };

const GROUPS: { label: string; items: { href: string; label: string; badge?: keyof AdminBadges }[] }[] = [
  { label: "Vue d'ensemble", items: [{ href: "/admin", label: "Tableau de bord" }, { href: "/admin/acquisition", label: "Acquisition" }, { href: "/admin/journal", label: "Journal" }] },
  { label: "Comptes", items: [{ href: "/admin/etablissements", label: "Établissements" }, { href: "/admin/utilisateurs", label: "Utilisateurs" }, { href: "/admin/parrainages", label: "Parrainages" }, { href: "/admin/metiers", label: "Métiers", badge: "jobs" }, { href: "/admin/mise-en-avant", label: "Mise en avant" }] },
  { label: "Relation pros", items: [{ href: "/admin/support", label: "Support", badge: "support" }, { href: "/admin/messages", label: "Messages aux pros" }, { href: "/admin/signalements", label: "Avis signalés", badge: "reports" }, { href: "/admin/aide", label: "Centre d'aide" }] },
  { label: "Ventes", items: [{ href: "/admin/factures", label: "Factures" }, { href: "/admin/promotions", label: "Codes promo" }, { href: "/admin/liens-acces", label: "Liens d'accès" }] },
  { label: "Plateforme", items: [{ href: "/admin/fonctionnalites", label: "Fonctionnalités" }, { href: "/admin/blog", label: "Blog" }] },
];

export function AdminNav({ badges }: { badges: AdminBadges }) {
  const path = usePathname();
  return (
    <nav aria-label="Administration" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-5 lg:overflow-visible lg:pb-0">
      {GROUPS.map((g) => (
        <div key={g.label} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
          <p className="hidden px-3 pb-1 text-xs font-medium tracking-wide text-muted uppercase lg:block">{g.label}</p>
          {g.items.map((i) => {
            const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
            const n = i.badge ? badges[i.badge] : 0;
            return (
              <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={cn("flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-accent-soft text-accent-soft-foreground" : "text-muted hover:bg-surface-muted hover:text-text")}>
                {i.label}
                {n > 0 ? <span className="rounded-full bg-accent px-1.5 text-xs leading-5 font-semibold text-accent-foreground tabular-nums">{n}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

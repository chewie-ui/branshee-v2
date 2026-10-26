"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Building2, Check, ChevronDown, LayoutGrid, LogOut, Plus, UserRound } from "lucide-react";
import { logout } from "@/server/actions/auth";
import { switchBusiness } from "@/server/actions/business";
import { cn } from "@/lib/cn";
import { activeNavHref, appForPath, type AppIcon as AppIconName, type AppNavItem } from "@/lib/apps";
import { AppIcon } from "@/components/apps/app-icon";
import { BrandMark } from "@/components/brand";
import { Avatar } from "@/components/ui/avatar";
import { NAV_ICONS } from "@/components/app/nav-icons";

export type ShellApp = { id: string; name: string; icon: AppIconName; href: string; nav: AppNavItem[]; match?: string[] };
type Biz = { id: string; name: string; businessType: string | null };

/**
 * Espace client Skydev : barre du haut avec le bouton « toutes les apps », le nom de l'app ouverte
 * et ses menus en onglets. Sur l'accueil (/app), aucune app n'est ouverte : la grille des apps s'affiche.
 */
export function SkydevShell({ apps, business, businesses, user, badges, children }: { apps: ShellApp[]; business: Biz; businesses: Biz[]; user: { name: string; email: string; avatarUrl: string | null }; badges: Record<string, number>; children: ReactNode }) {
  const pathname = usePathname();
  const app = pathname === "/app" ? null : appForPath(apps, pathname);
  const active = app ? activeNavHref(app.nav, pathname) : null;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          <Link href="/app" className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-surface-muted", !app ? "text-accent" : "text-muted hover:text-text")} aria-label="Toutes les apps" title="Toutes les apps">
            <LayoutGrid className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </Link>
          {app ? (
            <Link href={app.href} className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-muted">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent"><AppIcon icon={app.icon} className="size-4" /></span>
              <span className="truncate font-semibold">{app.name}</span>
            </Link>
          ) : (
            <Link href="/app" className="flex items-center gap-2 px-1" aria-label="Accueil Skydev">
              <BrandMark brand="skydev" className="size-7" />
              <span className="font-semibold tracking-tight">Skydev</span>
            </Link>
          )}
          <div className="ml-auto">
            <AccountMenu business={business} businesses={businesses} user={user} />
          </div>
        </div>
        {app && app.nav.length > 1 ? (
          <nav aria-label={`Menus ${app.name}`} className="-mb-px flex gap-1 overflow-x-auto px-3 sm:px-4">
            {app.nav.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              const on = item.href === active;
              const badge = badges[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={cn("flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors", on ? "border-accent text-text" : "border-transparent text-muted hover:text-text")}
                >
                  <Icon className={cn("size-4", on ? "text-accent" : "")} strokeWidth={1.75} aria-hidden="true" />
                  {item.label}
                  {item.soon ? <span className="rounded bg-warning-soft px-1.5 text-[11px] font-semibold text-warning">Bientôt</span> : null}
                  {badge ? <span className="rounded-full bg-accent px-1.5 text-[11px] leading-5 font-semibold text-accent-foreground" aria-label={`${badge} en attente`}>{badge}</span> : null}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </header>
      <main>
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}

function AccountMenu({ business, businesses, user }: { business: Biz; businesses: Biz[]; user: { name: string; email: string; avatarUrl: string | null } }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" className="flex h-10 items-center gap-2 rounded-lg px-1.5 transition-colors hover:bg-surface-muted sm:pr-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground" aria-hidden="true">{business.name.charAt(0).toUpperCase()}</span>
        <span className="hidden max-w-40 truncate text-sm font-medium sm:block">{business.name}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden="true" />
        <span className="sr-only">Compte et établissement</span>
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} aria-label="Fermer" tabIndex={-1} />
          <div role="menu" className="absolute top-full right-0 z-20 mt-1 w-72 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user.name}</span>
                <span className="block truncate text-xs text-muted">{user.email}</span>
              </span>
            </div>
            <div className="my-1 border-t border-border" />
            <p className="px-2 py-1.5 text-xs font-medium text-muted">Vos établissements</p>
            {businesses.map((b) => (
              <form key={b.id} action={switchBusiness.bind(null, b.id)}>
                <button type="submit" role="menuitem" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-surface-muted">
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  {b.id === business.id ? <Check className="size-4 shrink-0 text-accent" aria-label="Actif" /> : null}
                </button>
              </form>
            ))}
            <Link href="/app/etablissements" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted hover:bg-surface-muted hover:text-text"><Building2 className="size-4" aria-hidden="true" />Mes établissements</Link>
            <Link href="/bienvenue" role="menuitem" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted hover:bg-surface-muted hover:text-text"><Plus className="size-4" aria-hidden="true" />Ajouter un établissement</Link>
            <div className="my-1 border-t border-border" />
            <Link href="/app/compte" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted hover:bg-surface-muted hover:text-text"><UserRound className="size-4" aria-hidden="true" />Mon compte</Link>
            <form action={logout}>
              <button type="submit" role="menuitem" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted hover:bg-surface-muted hover:text-text"><LogOut className="size-4" aria-hidden="true" />Se déconnecter</button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}

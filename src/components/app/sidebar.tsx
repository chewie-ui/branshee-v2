"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Check, ChevronsUpDown, Building2, Gift, LifeBuoy, LogOut, Menu, Plus, Settings, X } from "lucide-react";
import { NAV_ICONS } from "@/components/app/nav-icons";
import { logout } from "@/server/actions/auth";
import { switchBusiness } from "@/server/actions/business";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Brand } from "@/components/brand";
import type { BrandId } from "@/lib/brand";

const ICONS = NAV_ICONS;

type Props = {
  brand: BrandId;
  groups: { label: string | null; items: NavItem[] }[];
  footer: NavItem[];
  business: { id: string; name: string; businessType: string | null };
  businesses: { id: string; name: string; businessType: string | null }[];
  user: { name: string; email: string; avatarUrl: string | null };
  pendingCount: number;
  supportUnread?: number;
  /** Menu actif imposé (apps Skydev : le plus long début d'adresse), sinon actif par début d'adresse. */
  activeHref?: string | null;
};

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ item, pathname, badge, activeHref }: { item: NavItem; pathname: string; badge?: number; activeHref?: string | null }) {
  const Icon = ICONS[item.icon];
  const active = activeHref !== undefined && item.href !== "/app" ? item.href === activeHref : isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors duration-150",
        active ? "bg-surface-muted text-text" : "text-muted hover:bg-surface-muted hover:text-text",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-muted group-hover:text-text")} strokeWidth={1.75} aria-hidden="true" />
      <span className="truncate">{item.label}</span>
      {badge ? (
        <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] leading-5 font-semibold text-accent-foreground" aria-label={`${badge} en attente`}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function BusinessSwitcher({ current, all, brand }: { current: Props["business"]; all: Props["businesses"]; brand: BrandId }) {
  const [open, setOpen] = useState(false);
  const sky = brand === "skydev";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-2 text-left transition-colors hover:bg-surface-muted"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground" aria-hidden="true">
          {current.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text">{current.name}</span>
          {current.businessType ? <span className="block truncate text-xs text-muted">{current.businessType}</span> : null}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} aria-label="Fermer" tabIndex={-1} />
          <div role="menu" className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg border border-border bg-surface p-1 shadow-lg">
            <p className="px-2 py-1.5 text-xs font-medium text-muted">{sky ? "Vos entreprises" : "Vos établissements"}</p>
            {all.map((b) => (
              <form key={b.id} action={switchBusiness.bind(null, b.id)}>
                <button type="submit" role="menuitem" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-surface-muted">
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  {b.id === current.id ? <Check className="size-4 shrink-0 text-accent" aria-label="Actif" /> : null}
                </button>
              </form>
            ))}
            <div className="my-1 border-t border-border" />
            <Link href="/app/etablissements" role="menuitem" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted hover:bg-surface-muted hover:text-text">
              <Building2 className="size-4" aria-hidden="true" />
              {sky ? "Mes entreprises" : "Mes établissements"}
            </Link>
            <Link href="/bienvenue" role="menuitem" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted hover:bg-surface-muted hover:text-text">
              <Plus className="size-4" aria-hidden="true" />
              {sky ? "Ajouter une entreprise" : "Ajouter un établissement"}
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SidebarContent({ brand, groups, footer, business, businesses, user, pendingCount, supportUnread = 0, activeHref, pathname }: Props & { pathname: string }) {
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 p-3">
        <Link href="/app" className="flex h-9 items-center rounded-lg px-1" aria-label="Accueil">
          <Brand brand={brand} small />
        </Link>
        <BusinessSwitcher current={business} all={businesses} brand={brand} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Navigation principale">
        {groups.map((group) => (
          <div key={group.label ?? "main"} className="mt-4 first:mt-1">
            {group.label ? <p className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{group.label}</p> : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} pathname={pathname} badge={item.href === "/app/demandes" ? pendingCount : undefined} activeHref={activeHref} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <ul className="space-y-0.5">
          {footer.map((item) => (
            <li key={item.href}>
              {item.href === "/app/parrainage" ? (
                <Link href={item.href} aria-current={pathname === item.href ? "page" : undefined} className="mt-1 flex items-center gap-3 rounded-lg bg-accent-soft px-2.5 py-2 text-sm font-medium text-accent-soft-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <Gift className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              ) : (
                <NavLink item={item} pathname={pathname} badge={item.href === "/app/aide" ? supportUnread : undefined} />
              )}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center gap-1">
          <Link href="/app/compte" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-muted">
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-text">{user.name}</span>
              <span className="block truncate text-xs text-muted">{user.email}</span>
            </span>
          </Link>
          <form action={logout}>
            <button type="submit" className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-text" aria-label="Se déconnecter" title="Se déconnecter">
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * Accueil Skydev (lanceur d'apps) : pas de barre latérale, une barre en haut avec la marque, l'entreprise,
 * les réglages, l'aide et le compte (déconnexion comprise).
 */
export function HomeTopBar({ brand, business, businesses, user, footer, supportUnread = 0 }: Pick<Props, "brand" | "business" | "businesses" | "user" | "footer" | "supportUnread">) {
  const settings = footer.find((i) => i.href === "/app/reglages");
  const help = footer.find((i) => i.href === "/app/aide");
  const invite = footer.find((i) => i.href === "/app/parrainage");
  const iconBtn = "relative flex size-10 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-text sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:font-medium";
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2 sm:h-16 sm:flex-nowrap sm:gap-3 sm:px-6 sm:py-0">
        <Link href="/app" className="flex h-10 shrink-0 items-center rounded-lg px-1" aria-label={`${brand === "skydev" ? "Skydev" : "Branshee"}, accueil`}>
          <Brand brand={brand} small />
        </Link>
        <div className="order-last min-w-0 basis-full sm:order-none sm:w-60 sm:basis-auto">
          <BusinessSwitcher current={business} all={businesses} brand={brand} />
        </div>
        <nav className="ml-auto flex items-center gap-1" aria-label="Compte">
          {invite ? (
            <Link href={invite.href} className="flex h-10 items-center gap-2 rounded-lg bg-accent-soft px-3 text-sm font-medium text-accent-soft-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label="Parrainage : 1 mois offert par pro invité">
              <Gift className="size-4" aria-hidden="true" /><span className="hidden sm:inline">1 mois offert</span>
            </Link>
          ) : null}
          {settings ? <Link href={settings.href} className={iconBtn} aria-label="Réglages"><Settings className="size-5 sm:size-4" aria-hidden="true" /><span className="hidden sm:inline">Réglages</span></Link> : null}
          {help ? (
            <Link href={help.href} className={iconBtn} aria-label={supportUnread ? `Aide et support, ${supportUnread} message${supportUnread > 1 ? "s" : ""} non lu${supportUnread > 1 ? "s" : ""}` : "Aide et support"}>
              <LifeBuoy className="size-5 sm:size-4" aria-hidden="true" /><span className="hidden md:inline">Aide et support</span>
              {supportUnread ? <span className="absolute top-1 right-1 size-2 rounded-full bg-accent sm:static sm:size-auto sm:px-1.5 sm:text-[11px] sm:leading-5 sm:font-semibold sm:text-accent-foreground" aria-hidden="true">{supportUnread}</span> : null}
            </Link>
          ) : null}
          <Link href="/app/compte" className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-surface-muted" aria-label="Mon compte" title={user.email}>
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            <span className="hidden max-w-32 truncate text-sm font-medium lg:block">{user.name}</span>
          </Link>
          <form action={logout}>
            <button type="submit" className="flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-text" aria-label="Se déconnecter" title="Se déconnecter">
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

export function Sidebar(props: Props) {
  const pathname = usePathname();
  // Le tiroir mobile est lié à la page où il a été ouvert : il se ferme tout seul en changeant de page.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (value: boolean) => setOpenedOn(value ? pathname : null);

  return (
    <>
      {/* Barre du haut — mobile uniquement */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="-ml-2 flex size-11 items-center justify-center rounded-lg text-text hover:bg-surface-muted" aria-label="Ouvrir le menu">
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <span className="truncate text-sm font-semibold">{props.business.name}</span>
      </div>

      {/* Tiroir mobile */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-label="Fermer le menu" />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label="Fermer le menu">
              <X className="size-5" aria-hidden="true" />
            </button>
            <SidebarContent {...props} pathname={pathname} />
          </div>
        </div>
      ) : null}

      {/* Colonne fixe — ordinateur */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-border bg-surface lg:block">
        <SidebarContent {...props} pathname={pathname} />
      </aside>
    </>
  );
}

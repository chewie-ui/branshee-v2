"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { BusinessSwitcher } from "@/components/app/sidebar";
import { Avatar } from "@/components/ui/avatar";
import { Brand } from "@/components/brand";
import type { BrandId } from "@/lib/brand";
import { logout } from "@/server/actions/auth";

/** Barre du haut de l'espace client : la même que côté pro (menu entreprise, compte, déconnexion). */
export function ClientTopBar({ brand, businesses, user }: { brand: BrandId; businesses: { id: string; name: string; businessType: string | null }[]; user: { name: string; email: string; avatarUrl: string | null } }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2 sm:h-16 sm:flex-nowrap sm:gap-3 sm:px-6 sm:py-0">
      <Link href="/espace-client" className="flex h-10 shrink-0 items-center rounded-lg px-1" aria-label="Espace client, accueil">
        <Brand brand={brand} small />
      </Link>
      <div className="order-last min-w-0 basis-full sm:order-none sm:w-60 sm:basis-auto">
        <BusinessSwitcher current={null} all={businesses} brand={brand} />
      </div>
      <nav className="ml-auto flex items-center gap-1" aria-label="Compte">
        <Link href="/espace-client/parametres" className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-surface-muted" aria-label="Mon compte" title={user.email}>
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
  );
}

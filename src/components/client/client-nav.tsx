"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/espace-client", label: "Accueil" },
  { href: "/espace-client/rendez-vous", label: "Rendez-vous" },
  { href: "/espace-client/fidelite", label: "Fidélité" },
  { href: "/espace-client/commandes", label: "Commandes" },
  { href: "/espace-client/avis", label: "Mes avis" },
  { href: "/espace-client/parametres", label: "Paramètres" },
];

/** Onglets de l'espace client : toujours les mêmes (chaque page explique quoi faire quand elle est vide). */
export function ClientNav() {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6" aria-label="Espace client">
      {ITEMS.map((i) => {
        const active = path === i.href;
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={cn("border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap", active ? "border-accent text-text" : "border-transparent text-muted hover:text-text")}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type Sections = { appts: boolean; orders: boolean; cards: boolean; reviews: boolean };

/** Onglets selon ce que la personne utilise : « Accueil » et « Paramètres » toujours, le reste s'il y a du contenu. */
export function ClientNav({ sections: s }: { sections: Sections }) {
  const path = usePathname();
  const ITEMS = [
    { href: "/espace-client", label: s.appts ? "Mes rendez-vous" : "Accueil" },
    s.orders ? { href: "/espace-client/commandes", label: "Mes commandes" } : null,
    s.cards ? { href: "/espace-client/fidelite", label: "Fidélité" } : null,
    s.appts || s.reviews ? { href: "/espace-client/avis", label: "Mes avis" } : null,
    { href: "/espace-client/parametres", label: "Paramètres" },
  ].filter((i) => i !== null);
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

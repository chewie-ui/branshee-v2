"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/etablissements", label: "Établissements" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Administration" className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
      {ITEMS.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={cn("shrink-0 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-accent-soft text-accent-soft-foreground" : "text-muted hover:bg-surface-muted hover:text-text")}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

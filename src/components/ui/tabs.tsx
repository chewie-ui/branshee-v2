"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Onglets basés sur des URL (chaque onglet a sa propre adresse, partageable). */
export function Tabs({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border px-1" aria-label="Onglets">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "border-accent text-text" : "border-transparent text-muted hover:text-text",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

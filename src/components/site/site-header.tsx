"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/annuaire", label: "Trouver un pro" },
  { href: "/blog", label: "Blog" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Branshee, accueil" className="rounded-lg focus-visible:outline-2 focus-visible:outline-accent">
          <Brand />
        </Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn("rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-muted hover:text-text", path === n.href ? "text-text" : "text-muted")}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Link href="/app" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover">Mon espace</Link>
          ) : (
            <>
              <Link href="/connexion" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface-muted hover:text-text">Connexion</Link>
              <Link href="/inscription" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground shadow-sm hover:bg-accent-hover">Essai gratuit</Link>
            </>
          )}
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="ml-auto flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-muted md:hidden" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open}>
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </div>
      {open ? (
        <nav aria-label="Navigation principale" className="border-t border-border bg-surface px-4 py-3 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-base font-medium hover:bg-surface-muted">{n.label}</Link>
          ))}
          <div className="mt-2 grid gap-2 border-t border-border pt-3">
            {signedIn ? (
              <Link href="/app" className="flex h-11 items-center justify-center rounded-lg bg-accent text-sm font-medium text-accent-foreground">Mon espace</Link>
            ) : (
              <>
                <Link href="/inscription" className="flex h-11 items-center justify-center rounded-lg bg-accent text-sm font-medium text-accent-foreground">Essai gratuit</Link>
                <Link href="/connexion" className="flex h-11 items-center justify-center rounded-lg border border-border-strong text-sm font-medium">Connexion</Link>
              </>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

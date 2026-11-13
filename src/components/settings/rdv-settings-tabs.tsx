"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useT } from "@/components/app-locale";

const TABS = [
  { href: "/app/rdv/parametres", label: "Règles de réservation" },
  { href: "/app/rdv/parametres/notifications", label: "Emails aux clients" },
];

export function RdvSettingsTabs() {
  const t = useT();
  const path = usePathname();
  return (
    <nav aria-label={t("Réglages de RDV")} className="flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((x) => (
        <Link key={x.href} href={x.href} aria-current={path === x.href ? "page" : undefined} className={cn("-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap", path === x.href ? "border-accent text-text" : "border-transparent text-muted hover:text-text")}>
          {t(x.label)}
        </Link>
      ))}
    </nav>
  );
}

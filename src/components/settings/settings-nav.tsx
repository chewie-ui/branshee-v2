"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export const SETTINGS_SECTIONS = [
  { href: "/app/reglages/etablissement", label: "Établissement", ready: true },
  { href: "/app/reglages/reservation", label: "Règles de réservation", ready: true },
  { href: "/app/reglages/notifications", label: "Notifications", ready: true },
  { href: "/app/reglages/sms", label: "SMS et WhatsApp", ready: true },
  { href: "/app/reglages/paiements", label: "Paiements", ready: true },
  { href: "/app/reglages/integrations", label: "Intégrations", ready: false },
  { href: "/app/reglages/abonnement", label: "Abonnement", ready: true },
  { href: "/app/reglages/journal", label: "Journal d'activité", ready: true },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections des réglages" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0">
      {SETTINGS_SECTIONS.map((s) =>
        s.ready ? (
          <Link
            key={s.href}
            href={s.href}
            aria-current={pathname === s.href ? "page" : undefined}
            className={cn("rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors", pathname === s.href ? "bg-surface text-text shadow-sm ring-1 ring-border" : "text-muted hover:bg-surface hover:text-text")}
          >
            {s.label}
          </Link>
        ) : (
          <span key={s.href} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap text-muted" aria-disabled="true">
            {s.label}
            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium">Bientôt</span>
          </span>
        ),
      )}
    </nav>
  );
}

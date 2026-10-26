import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { APPS, BILLING_LABEL, type SkyApp } from "@/lib/apps";
import { AppIcon } from "@/components/apps/app-icon";
import { Badge } from "@/components/ui/badge";

function StatusBadge({ app }: { app: SkyApp }) {
  if (app.status === "soon") return <Badge tone="warning">Bientôt</Badge>;
  if (app.billing === "included") return <Badge tone="success">{BILLING_LABEL.included}</Badge>;
  return <Badge tone="accent">{BILLING_LABEL[app.billing]}</Badge>;
}

/** Lanceur d'apps : toutes les apps de la plateforme, accessibles depuis un seul espace. */
export function AppLauncher() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {APPS.map((app) => (
        <li key={app.id}>
          <Link
            href={app.href}
            className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-sm"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <AppIcon icon={app.icon} />
              </span>
              <StatusBadge app={app} />
            </span>
            <span className="mt-4 flex items-center gap-1.5 text-base font-semibold text-text">
              {app.name}
              <ArrowUpRight className="size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </span>
            <span className="mt-1 text-sm text-muted">{app.tagline}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

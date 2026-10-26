import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type { SkyApp } from "@/lib/apps";
import { AppIcon } from "@/components/apps/app-icon";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

/** Page d'une app pas encore construite (ou activée sur demande) : ce qu'elle fera, et quoi faire en attendant. */
export function AppPlaceholder({ app, title, text, action }: { app: SkyApp; title: string; text: string; action?: ReactNode }) {
  return (
    <>
      <PageHeader title={app.name} description={app.tagline} />
      <Card className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <AppIcon icon={app.icon} className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{title}</p>
              {app.status === "soon" ? <Badge tone="warning">Bientôt</Badge> : null}
            </div>
            <p className="mt-1 max-w-prose text-sm text-muted">{text}</p>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {app.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            {action ? <div className="mt-6 flex flex-wrap gap-2">{action}</div> : null}
          </div>
        </div>
      </Card>
    </>
  );
}

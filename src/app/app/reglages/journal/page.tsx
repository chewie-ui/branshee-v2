import type { Metadata } from "next";
import { History } from "lucide-react";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDay, formatTime } from "@/lib/time";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Journal d'activité · Réglages" };

export default async function ActivityLogPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireContext("logs.view");
  const tz = ctx.business.timezone;
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const like = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
  const rows = await db
    .select()
    .from(activityLogs)
    .where(and(eq(activityLogs.businessId, ctx.business.id), q ? or(ilike(activityLogs.description, like), ilike(activityLogs.actorName, like)) : undefined))
    .orderBy(desc(activityLogs.createdAt))
    .limit(300);

  return (
    <div className="space-y-4">
      <form role="search" className="max-w-sm">
        <label htmlFor="q" className="sr-only">Rechercher dans le journal</label>
        <input id="q" name="q" defaultValue={q} placeholder="Rechercher (personne, action…)" className="h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm placeholder:text-muted focus-visible:border-accent" />
      </form>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={<History />} title={q ? "Aucun résultat" : "Journal vide"} description="Les actions de l'équipe (RDV, horaires, prestations, réglages…) apparaîtront ici." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex gap-4 px-5 py-3 text-sm">
                <div className="w-28 shrink-0 text-muted tabular-nums">
                  <p>{formatDay(r.createdAt, tz, "d MMM yyyy")}</p>
                  <p>{formatTime(r.createdAt, tz)}</p>
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{r.description}</p>
                  <p className="text-muted">{r.actorName}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-xs text-muted">Les 300 dernières actions sont affichées.</p>
    </div>
  );
}

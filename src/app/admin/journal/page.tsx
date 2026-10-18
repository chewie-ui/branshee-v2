import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { desc, eq, ilike, lt, or, and } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, businesses } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay, formatTime } from "@/lib/time";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Journal" };
const TZ = "Europe/Brussels";

/** Journal d'activité de toute la plateforme (actions des équipes, pas le contenu des dossiers). */
export default async function AdminLogs({ searchParams }: { searchParams: Promise<{ q?: string; avant?: string }> }) {
  await requireSuperadmin();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const before = sp.avant && !Number.isNaN(Date.parse(sp.avant)) ? new Date(sp.avant) : null;
  const rows = await db
    .select({ id: activityLogs.id, at: activityLogs.createdAt, actor: activityLogs.actorName, action: activityLogs.action, description: activityLogs.description, businessId: businesses.id, business: businesses.name })
    .from(activityLogs)
    .innerJoin(businesses, eq(businesses.id, activityLogs.businessId))
    .where(and(q ? or(ilike(activityLogs.description, like), ilike(activityLogs.actorName, like), ilike(businesses.name, like), ilike(activityLogs.action, like)) : undefined, before ? lt(activityLogs.createdAt, before) : undefined))
    .orderBy(desc(activityLogs.createdAt))
    .limit(100);
  const last = rows.at(-1);
  return (
    <>
      <PageHeader title="Journal" description="Toutes les actions enregistrées dans les établissements, de la plus récente à la plus ancienne." />
      <form className="relative mb-4 max-w-md" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input name="q" defaultValue={q} placeholder="Établissement, personne, action…" className="pl-9" aria-label="Rechercher dans le journal" />
      </form>
      <Card>
        <ul className="divide-y divide-border">
          {rows.map((l) => (
            <li key={l.id} className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3 text-sm">
              <span className="w-36 shrink-0 text-muted tabular-nums">{formatDay(l.at, TZ, "d MMM yyyy")} {formatTime(l.at, TZ)}</span>
              <span className="min-w-0 flex-1">
                <span>{l.description}</span>
                <span className="block text-muted">
                  {l.actor} · <Link href={`/admin/etablissements/${l.businessId}`} className="hover:underline">{l.business}</Link> · <span className="font-mono text-xs">{l.action}</span>
                </span>
              </span>
            </li>
          ))}
          {rows.length === 0 ? <li className="px-5 py-4 text-sm text-muted">Aucune entrée.</li> : null}
        </ul>
      </Card>
      {rows.length === 100 && last ? (
        <div className="mt-4 text-center">
          <Link href={`/admin/journal?${new URLSearchParams({ ...(q ? { q } : {}), avant: last.at.toISOString() })}`} className="text-sm font-medium text-accent hover:text-accent-hover">Entrées plus anciennes</Link>
        </div>
      ) : null}
    </>
  );
}

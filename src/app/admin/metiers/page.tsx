import type { Metadata } from "next";
import { desc, isNotNull, isNull, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, jobTitles } from "@/db/schema";
import { JobDecision } from "@/components/admin/platform";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay } from "@/lib/time";
import { PROFESSIONS, professionKey } from "@/lib/professions";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Métiers" };

/**
 * Métiers hors de la liste officielle : demandes explicites des pros, et métiers réellement saisis
 * par des établissements (même sans demande). Validé = reconnu partout ; bloqué = refusé.
 */
export default async function AdminJobs() {
  await requireSuperadmin();
  const [titles, used] = await Promise.all([
    db.select().from(jobTitles).orderBy(desc(jobTitles.createdAt)),
    db
      .select({ type: businesses.businessType, n: sql<number>`count(*)::int` })
      .from(businesses)
      .where(and(isNull(businesses.deletedAt), isNotNull(businesses.businessType)))
      .groupBy(businesses.businessType),
  ]);
  const official = new Set(PROFESSIONS.map(professionKey));
  const known = new Map(titles.map((t) => [t.key, t]));
  const usage = new Map<string, { name: string; n: number }>();
  for (const u of used) {
    const name = (u.type ?? "").trim();
    if (!name) continue;
    const k = professionKey(name);
    if (official.has(k)) continue;
    const cur = usage.get(k);
    usage.set(k, { name: cur?.name ?? name, n: (cur?.n ?? 0) + u.n });
  }
  const pending = titles.filter((t) => t.status === "pending");
  const unlisted = [...usage.entries()].filter(([k]) => !known.has(k)).sort((a, b) => b[1].n - a[1].n);
  const decided = titles.filter((t) => t.status !== "pending");

  return (
    <>
      <PageHeader title="Métiers" description={`${PROFESSIONS.length} métiers dans la liste officielle. Les métiers validés ici s'y ajoutent.`} />
      <div className="space-y-6">
        <Card>
          <CardHeader title={`À trancher (${pending.length + unlisted.length})`} description="Demandes des pros, puis métiers saisis par des établissements mais absents de la liste." />
          <ul className="divide-y divide-border">
            {pending.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{t.name}</span> <Badge tone="accent">{t.source === "request" ? "Demandé" : "Utilisé"}</Badge>
                  <span className="block text-sm text-muted">{usage.get(t.key)?.n ?? 0} établissement(s) · {formatDay(t.createdAt, "Europe/Brussels", "d MMM yyyy")}</span>
                </span>
                <JobDecision name={t.name} status="pending" />
              </li>
            ))}
            {unlisted.map(([k, u]) => (
              <li key={k} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{u.name}</span> <Badge>Hors liste</Badge>
                  <span className="block text-sm text-muted">{u.n} établissement(s)</span>
                </span>
                <JobDecision name={u.name} status="unlisted" />
              </li>
            ))}
            {pending.length + unlisted.length === 0 ? <li className="px-5 py-4 text-sm text-muted">Rien à trancher.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Décidés" />
          <ul className="divide-y divide-border">
            {decided.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1 font-medium">{t.name}</span>
                <Badge tone={t.status === "approved" ? "success" : "danger"}>{t.status === "approved" ? "Validé" : "Bloqué"}</Badge>
                <JobDecision name={t.name} status={t.status} />
              </li>
            ))}
            {decided.length === 0 ? <li className="px-5 py-4 text-sm text-muted">Aucun métier décidé.</li> : null}
          </ul>
        </Card>
      </div>
    </>
  );
}

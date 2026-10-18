import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Acquisition" };

/** D'où viennent les visiteurs du site (UTM, référents) et combien s'inscrivent. */
export default async function AdminAcquisition({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  await requireSuperadmin();
  const days = [7, 30, 90].includes(Number((await searchParams).jours)) ? Number((await searchParams).jours) : 30;
  const since = sql`now() - make_interval(days => ${days})`;
  const [[totals], sources, paths, campaigns, daily] = await Promise.all([
    db.execute<{ views: number; visitors: number; signups: number; businesses: number }>(sql`
      select (select count(*)::int from page_views where created_at > ${since}) as views,
             (select count(distinct visitor_id)::int from page_views where created_at > ${since}) as visitors,
             (select count(*)::int from users where created_at > ${since}) as signups,
             (select count(*)::int from businesses where created_at > ${since} and deleted_at is null) as businesses`),
    db.execute<{ source: string; medium: string; visitors: number; views: number }>(sql`
      select coalesce(nullif(source, ''), 'direct') as source, coalesce(nullif(medium, ''), '—') as medium,
             count(distinct visitor_id)::int as visitors, count(*)::int as views
      from page_views where created_at > ${since} group by 1, 2 order by visitors desc limit 20`),
    db.execute<{ path: string; views: number }>(sql`select path, count(*)::int as views from page_views where created_at > ${since} group by path order by views desc limit 15`),
    db.execute<{ campaign: string; visitors: number; gclid: number }>(sql`
      select campaign, count(distinct visitor_id)::int as visitors, count(gclid)::int as gclid
      from page_views where created_at > ${since} and campaign is not null and campaign <> '' group by campaign order by visitors desc limit 15`),
    db.execute<{ day: string; visitors: number; signups: number }>(sql`
      select to_char(d, 'DD/MM') as day,
             (select count(distinct visitor_id)::int from page_views where created_at >= d and created_at < d + interval '1 day') as visitors,
             (select count(*)::int from users where created_at >= d and created_at < d + interval '1 day') as signups
      from generate_series(date_trunc('day', now()) - make_interval(days => ${Math.min(days, 30) - 1}), date_trunc('day', now()), interval '1 day') d order by d`),
  ]);
  const max = Math.max(1, ...daily.map((d) => d.visitors));
  const stats = [
    { label: "Visiteurs", value: totals?.visitors ?? 0 },
    { label: "Pages vues", value: totals?.views ?? 0 },
    { label: "Comptes créés", value: totals?.signups ?? 0 },
    { label: "Établissements créés", value: totals?.businesses ?? 0 },
  ];
  return (
    <>
      <PageHeader title="Acquisition" description="Visites des pages publiques (sans cookie publicitaire) et inscriptions." />
      <nav className="mb-4 flex gap-2 text-sm">
        {[7, 30, 90].map((d) => (
          <Link key={d} href={`/admin/acquisition?jours=${d}`} className={cn("rounded-full border px-3 py-1", d === days ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border text-muted")}>{d} jours</Link>
        ))}
      </nav>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value.toLocaleString("fr-BE")}</p>
          </Card>
        ))}
      </div>
      <Card className="mb-6">
        <CardHeader title="Visiteurs par jour" description={days > 30 ? "30 derniers jours" : undefined} />
        <div className="flex h-40 items-end gap-1 px-5 py-4" role="img" aria-label="Visiteurs par jour">
          {daily.map((d) => (
            <div key={d.day} className="group relative flex flex-1 flex-col items-center justify-end" title={`${d.day} : ${d.visitors} visiteur(s), ${d.signups} inscription(s)`}>
              <div className="w-full rounded-t bg-accent/70" style={{ height: `${(d.visitors / max) * 100}%`, minHeight: d.visitors ? 2 : 0 }} />
              {d.signups ? <span className="absolute -top-1 size-1.5 rounded-full bg-success" /> : null}
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sources" />
          <ul className="divide-y divide-border text-sm">
            {sources.map((s) => (
              <li key={`${s.source}-${s.medium}`} className="flex items-center gap-3 px-5 py-2.5">
                <span className="min-w-0 flex-1 truncate">{s.source} <span className="text-muted">/ {s.medium}</span></span>
                <span className="tabular-nums">{s.visitors}</span>
              </li>
            ))}
            {sources.length === 0 ? <li className="px-5 py-4 text-muted">Aucune visite enregistrée.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Pages les plus vues" />
          <ul className="divide-y divide-border text-sm">
            {paths.map((p) => (
              <li key={p.path} className="flex items-center gap-3 px-5 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{p.path}</span>
                <span className="tabular-nums">{p.views}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Campagnes (utm_campaign)" />
          <ul className="divide-y divide-border text-sm">
            {campaigns.map((c) => (
              <li key={c.campaign} className="flex items-center gap-3 px-5 py-2.5">
                <span className="min-w-0 flex-1 truncate">{c.campaign}</span>
                <span className="text-muted">{c.gclid ? `${c.gclid} clic(s) Google Ads` : ""}</span>
                <span className="tabular-nums">{c.visitors}</span>
              </li>
            ))}
            {campaigns.length === 0 ? <li className="px-5 py-4 text-muted">Aucune campagne.</li> : null}
          </ul>
        </Card>
      </div>
    </>
  );
}

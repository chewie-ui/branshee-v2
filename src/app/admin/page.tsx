import Link from "next/link";
import { and, count, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, businesses, users } from "@/db/schema";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay } from "@/lib/time";
import { requireSuperadmin } from "@/server/admin";

const TZ = "Europe/Brussels";

export default async function AdminDashboard() {
  await requireSuperadmin();
  const now = new Date().getTime();
  const d7 = new Date(now - 7 * 86400000);
  const d30 = new Date(now - 30 * 86400000);
  const one = <T extends { n: number }[]>(p: Promise<T>) => p.then((r) => r[0]?.n ?? 0);

  const [nbUsers, newUsers, nbBusinesses, paused, appts30, online30, activeBiz, recentBiz] = await Promise.all([
    one(db.select({ n: count() }).from(users)),
    one(db.select({ n: count() }).from(users).where(gte(users.createdAt, d7))),
    one(db.select({ n: count() }).from(businesses).where(isNull(businesses.deletedAt))),
    one(db.select({ n: count() }).from(businesses).where(and(isNull(businesses.deletedAt), isNotNull(businesses.pausedAt)))),
    one(db.select({ n: count() }).from(appointments).where(and(eq(appointments.kind, "appointment"), gte(appointments.createdAt, d30)))),
    one(db.select({ n: count() }).from(appointments).where(and(eq(appointments.kind, "appointment"), gte(appointments.createdAt, d30), isNull(appointments.createdById)))),
    one(db.select({ n: sql<number>`count(distinct ${appointments.businessId})::int` }).from(appointments).where(gte(appointments.createdAt, d30))),
    db
      .select({ id: businesses.id, name: businesses.name, type: businesses.businessType, city: businesses.city, createdAt: businesses.createdAt, owner: users.email })
      .from(businesses)
      .innerJoin(users, eq(users.id, businesses.ownerId))
      .where(isNull(businesses.deletedAt))
      .orderBy(desc(businesses.createdAt))
      .limit(8),
  ]);

  const stats = [
    { label: "Comptes", value: nbUsers, hint: `+${newUsers} cette semaine` },
    { label: "Établissements", value: nbBusinesses, hint: paused ? `${paused} en pause` : "Aucun en pause" },
    { label: "Établissements actifs", value: activeBiz, hint: "au moins un RDV créé en 30 jours" },
    { label: "RDV créés (30 j)", value: appts30, hint: `dont ${online30} en ligne` },
  ];

  return (
    <>
      <PageHeader title="Tableau de bord" description="Vue d'ensemble de la plateforme" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{s.value.toLocaleString("fr-BE")}</p>
            <p className="mt-1 text-sm text-muted">{s.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader title="Derniers établissements créés" action={<Link href="/admin/etablissements" className="text-sm font-medium text-accent hover:text-accent-hover">Tout voir</Link>} />
        <ul className="divide-y divide-border">
          {recentBiz.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/etablissements/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-muted">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{b.name}</span>
                  <span className="block truncate text-sm text-muted">{[b.type, b.city].filter(Boolean).join(" · ") || "—"} · {b.owner}</span>
                </span>
                <span className="text-sm text-muted">{formatDay(b.createdAt, TZ, "d MMM yyyy")}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

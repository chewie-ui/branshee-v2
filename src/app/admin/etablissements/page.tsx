import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, businesses, members, users } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay } from "@/lib/time";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Établissements" };

export default async function AdminBusinesses({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSuperadmin();
  const q = (await searchParams).q?.trim().slice(0, 80) ?? "";
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      type: businesses.businessType,
      city: businesses.city,
      pausedAt: businesses.pausedAt,
      createdAt: businesses.createdAt,
      owner: users.email,
      team: sql<number>`(select count(*)::int from ${members} where ${members.businessId} = ${businesses.id} and ${members.status} = 'active')`,
      appts: sql<number>`(select count(*)::int from ${appointments} where ${appointments.businessId} = ${businesses.id} and ${appointments.kind} = 'appointment')`,
    })
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .where(and(isNull(businesses.deletedAt), q ? or(ilike(businesses.name, like), ilike(businesses.slug, like), ilike(businesses.city, like), ilike(users.email, like)) : undefined))
    .orderBy(desc(businesses.createdAt))
    .limit(100);

  return (
    <>
      <PageHeader title="Établissements" description={q ? `${rows.length} résultat${rows.length > 1 ? "s" : ""} pour « ${q} »` : "Les 100 plus récents"} />
      <form className="relative mb-4 max-w-md" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input name="q" defaultValue={q} placeholder="Nom, lien, ville ou email du propriétaire" className="pl-9" aria-label="Rechercher un établissement" />
      </form>
      <Card>
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aucun établissement trouvé.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/etablissements/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-muted">
                  <span className="min-w-0 flex-1 basis-60">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{b.name}</span>
                      {b.pausedAt ? <Badge tone="warning">En pause</Badge> : null}
                    </span>
                    <span className="block truncate text-sm text-muted">/{b.slug} · {[b.type, b.city].filter(Boolean).join(" · ") || "—"}</span>
                  </span>
                  <span className="min-w-0 truncate text-sm text-muted sm:w-56">{b.owner}</span>
                  <span className="w-28 text-sm text-muted tabular-nums">{b.team} membre{b.team > 1 ? "s" : ""}</span>
                  <span className="w-24 text-sm text-muted tabular-nums">{b.appts} RDV</span>
                  <span className="w-24 text-right text-sm text-muted">{formatDay(b.createdAt, "Europe/Brussels", "d MMM yyyy")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

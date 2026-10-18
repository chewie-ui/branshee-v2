import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { and, asc, desc, gt, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { BoostInput } from "@/components/admin/platform";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Mise en avant" };

export default async function AdminBoost({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSuperadmin();
  const q = (await searchParams).q?.trim().slice(0, 80) ?? "";
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const cols = { id: businesses.id, name: businesses.name, city: businesses.city, type: businesses.businessType, boost: businesses.boostPosition };
  const [boosted, found] = await Promise.all([
    db.select(cols).from(businesses).where(and(isNull(businesses.deletedAt), gt(businesses.boostPosition, 0))).orderBy(asc(businesses.boostPosition), asc(businesses.name)),
    q ? db.select(cols).from(businesses).where(and(isNull(businesses.deletedAt), or(ilike(businesses.name, like), ilike(businesses.slug, like), ilike(businesses.city, like)))).orderBy(desc(businesses.createdAt)).limit(30) : Promise.resolve([]),
  ]);
  const Row = ({ b }: { b: (typeof boosted)[number] }) => (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="min-w-0 flex-1">
        <Link href={`/admin/etablissements/${b.id}`} className="block truncate font-medium hover:underline">{b.name}</Link>
        <span className="block truncate text-sm text-muted">{[b.type, b.city].filter(Boolean).join(" · ") || "—"}</span>
      </span>
      <BoostInput id={b.id} position={b.boost} />
    </li>
  );
  return (
    <>
      <PageHeader title="Mise en avant" description="Établissements affichés en premier sur la page d'accueil et dans l'annuaire. 1 = en premier ; 0 = pas de mise en avant." />
      <Card className="mb-6">
        <CardHeader title={`Mis en avant (${boosted.length})`} />
        <ul className="divide-y divide-border">
          {boosted.map((b) => <Row key={b.id} b={b} />)}
          {boosted.length === 0 ? <li className="px-5 py-4 text-sm text-muted">Aucun établissement mis en avant.</li> : null}
        </ul>
      </Card>
      <form className="relative mb-4 max-w-md" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input name="q" defaultValue={q} placeholder="Chercher un établissement à mettre en avant" className="pl-9" aria-label="Rechercher un établissement" />
      </form>
      {q ? (
        <Card>
          <ul className="divide-y divide-border">
            {found.map((b) => <Row key={b.id} b={b} />)}
            {found.length === 0 ? <li className="px-5 py-4 text-sm text-muted">Aucun résultat.</li> : null}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

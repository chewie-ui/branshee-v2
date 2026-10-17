import type { Metadata } from "next";
import Link from "next/link";
import { Search, UserRound } from "lucide-react";
import { and, count, eq, ilike, max, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, customers } from "@/db/schema";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay } from "@/lib/time";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Clients" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireContext("customers.view");
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const tz = ctx.business.timezone;

  const where = [eq(customers.businessId, ctx.business.id)];
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    where.push(or(ilike(customers.fullName, like), ilike(customers.email, like), ilike(customers.phone, like))!);
  }

  const rows = await db
    .select({
      id: customers.id,
      name: customers.fullName,
      email: customers.email,
      phone: customers.phone,
      blockedAt: customers.blockedAt,
      visits: count(appointments.id),
      lastVisit: max(appointments.startsAt),
    })
    .from(customers)
    .leftJoin(appointments, and(eq(appointments.customerId, customers.id), ne(appointments.status, "cancelled"), sql`${appointments.startsAt} <= now()`))
    .where(and(...where))
    .groupBy(customers.id)
    .orderBy(sql`max(${appointments.startsAt}) desc nulls last`, customers.fullName)
    .limit(200);

  return (
    <>
      <PageHeader title="Clients" description={q ? `${rows.length} résultat${rows.length > 1 ? "s" : ""} pour « ${q} »` : `${rows.length} client${rows.length > 1 ? "s" : ""}`} />

      <form className="relative mb-4 max-w-md" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <label htmlFor="q" className="sr-only">
          Rechercher un client
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Nom, email ou téléphone"
          className="h-10 w-full rounded-lg border border-border-strong bg-surface pr-3 pl-9 text-sm placeholder:text-muted hover:border-muted focus-visible:border-accent"
        />
      </form>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<UserRound />}
            title={q ? "Aucun client trouvé" : "Pas encore de client"}
            description={q ? "Vérifiez l'orthographe ou cherchez par email ou téléphone." : "Vos clients apparaîtront ici dès leur première réservation."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Client</th>
                  <th scope="col" className="hidden px-5 py-2.5 font-medium md:table-cell">Téléphone</th>
                  <th scope="col" className="hidden px-5 py-2.5 font-medium sm:table-cell">Dernière visite</th>
                  <th scope="col" className="hidden px-5 py-2.5 text-right font-medium sm:table-cell">Visites</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-surface-muted/60">
                    <td className="px-5 py-3">
                      <Link href={`/app/clients/${c.id}`} className="flex items-center gap-3">
                        <Avatar name={c.name} size="sm" />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 font-medium text-text">
                            <span className="truncate">{c.name}</span>
                            {c.blockedAt ? <Badge tone="danger">Bloqué</Badge> : null}
                          </span>
                          {c.email ? <span className="block truncate text-muted">{c.email}</span> : null}
                          <span className="block text-muted sm:hidden">Dernière visite : {c.lastVisit ? formatDay(new Date(c.lastVisit), tz, "d MMM yyyy") : "jamais"}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-5 py-3 text-muted md:table-cell">{c.phone ?? "—"}</td>
                    <td className="hidden px-5 py-3 whitespace-nowrap text-muted sm:table-cell">{c.lastVisit ? formatDay(new Date(c.lastVisit), tz, "d MMM yyyy") : "Jamais"}</td>
                    <td className="hidden px-5 py-3 text-right tabular-nums sm:table-cell">{c.visits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

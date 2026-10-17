import type { Metadata } from "next";
import { Search, UserPlus } from "lucide-react";
import { and, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { CustomersTable } from "@/components/customers/customers-table";
import { NewCustomerForm } from "@/components/customers/panels";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { clientWord } from "@/lib/terminology";
import { formatDay } from "@/lib/time";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Clients" };

type SearchParams = Promise<{ q?: string; periode?: string; statut?: string; nouveau?: string }>;

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireContext("customers.view");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const periode = ["avenir", "7", "30", "90"].includes(sp.periode ?? "") ? sp.periode! : "";
  const statut = ["confirmed", "cancelled", "noshow", "blocked"].includes(sp.statut ?? "") ? sp.statut! : "";
  const tz = ctx.business.timezone;
  const term = clientWord(ctx.business.businessType);
  const terms = clientWord(ctx.business.businessType, { plural: true });

  // Dernier rendez-vous de chaque fiche (statut, membre, date) et nombre total, en une requête.
  // Colonne qualifiée en clair : dans un select sur une seule table, Drizzle écrit « "id" », ambigu dans les sous-requêtes.
  const cid = sql.raw(`"customers"."id"`);
  const last = sql`(select a.starts_at from appointments a where a.customer_id = ${cid} and a.kind = 'appointment' order by a.starts_at desc limit 1)`;
  const where: SQL[] = [eq(customers.businessId, ctx.business.id)];
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    where.push(or(ilike(customers.fullName, like), ilike(customers.email, like), ilike(customers.phone, like), ilike(customers.altName, like), ilike(customers.altEmail, like), ilike(customers.altPhone, like))!);
  }
  if (periode === "avenir") where.push(sql`exists (select 1 from appointments a where a.customer_id = ${cid} and a.starts_at > now() and a.status <> 'cancelled')`);
  else if (periode) where.push(sql`${last} >= now() - (${Number(periode)} || ' days')::interval and ${last} <= now()`);
  if (statut === "blocked") where.push(sql`${customers.blockedAt} is not null`);
  else if (statut === "noshow") where.push(sql`exists (select 1 from appointments a where a.customer_id = ${cid} and a.no_show)`);
  else if (statut) where.push(sql`(select a.status from appointments a where a.customer_id = ${cid} and a.kind = 'appointment' order by a.starts_at desc limit 1) = ${statut}`);

  const rows = await db
    .select({
      id: customers.id,
      name: customers.fullName,
      email: customers.email,
      phone: customers.phone,
      blockedAt: customers.blockedAt,
      count: sql<number>`(select count(*)::int from appointments a where a.customer_id = ${cid} and a.kind = 'appointment')`,
      lastAt: sql<Date | null>`${last}`.mapWith((v) => (v ? new Date(v) : null)),
      lastStatus: sql<string | null>`(select case when a.no_show then 'noshow' else a.status::text end from appointments a where a.customer_id = ${cid} and a.kind = 'appointment' order by a.starts_at desc limit 1)`,
      lastMember: sql<string | null>`(select m.display_name from appointments a join members m on m.id = a.member_id where a.customer_id = ${cid} and a.kind = 'appointment' order by a.starts_at desc limit 1)`,
    })
    .from(customers)
    .where(and(...where))
    .orderBy(sql`${last} desc nulls last`, customers.fullName)
    .limit(300);

  const filtered = !!(q || periode || statut);
  return (
    <>
      <PageHeader
        title={clientWord(ctx.business.businessType, { plural: true, capitalize: true })}
        description={filtered ? `${rows.length} résultat${rows.length > 1 ? "s" : ""}` : `${rows.length}${rows.length === 300 ? "+" : ""} ${rows.length > 1 ? terms : term}`}
        action={ctx.can("customers.manage") ? <ButtonLink href="/app/clients?nouveau=1" variant="secondary" icon={<UserPlus className="size-4" aria-hidden="true" />}>Ajouter un {term}</ButtonLink> : null}
      />
      {sp.nouveau && ctx.can("customers.manage") ? <NewCustomerForm key="new" term={term} initialOpen /> : null}

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input name="q" defaultValue={q} placeholder="Nom, email ou téléphone" className="pl-9" aria-label={`Rechercher un ${term}`} />
        </div>
        <Select name="periode" defaultValue={periode} className="w-auto" aria-label="Période">
          <option value="">Toutes les dates</option>
          <option value="avenir">RDV à venir</option>
          <option value="7">Venus ces 7 jours</option>
          <option value="30">Venus ces 30 jours</option>
          <option value="90">Venus ces 90 jours</option>
        </Select>
        <Select name="statut" defaultValue={statut} className="w-auto" aria-label="Statut">
          <option value="">Tous les statuts</option>
          <option value="confirmed">Dernier RDV confirmé</option>
          <option value="cancelled">Dernier RDV annulé</option>
          <option value="noshow">Au moins une absence</option>
          <option value="blocked">Bloqués</option>
        </Select>
        <button type="submit" className="h-10 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted">Filtrer</button>
      </form>

      <Card className="overflow-hidden">
        <CustomersTable
          term={term}
          filtered={filtered}
          canDelete={ctx.can("customers.manage")}
          rows={rows.map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, blocked: !!r.blockedAt, count: r.count, last: r.lastAt ? formatDay(r.lastAt, tz, "d MMM yyyy") : null, lastStatus: r.lastStatus, member: r.lastMember }))}
        />
      </Card>
    </>
  );
}

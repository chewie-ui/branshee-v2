import type { Metadata } from "next";
import { Download, FileUp, Inbox, Search, UserPlus } from "lucide-react";
import { and, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { CustomersTable } from "@/components/customers/customers-table";
import { NewCustomerForm } from "@/components/customers/panels";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { clientWord, isPatientProfession } from "@/lib/terminology";
import { normalizeNiss, validNiss } from "@/lib/niss";
import { blindIndex } from "@/lib/field-crypto";
import { formatDay } from "@/lib/time";
import { requireContext } from "@/server/context";
import { currentBrand } from "@/server/brand";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Clients");

type SearchParams = Promise<{ q?: string; periode?: string; statut?: string; nouveau?: string; sexe?: string; age?: string; dossier?: string; pathologie?: string; prescripteur?: string }>;

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await appT();
  const ctx = await requireContext("customers.view");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const periode = ["avenir", "7", "30", "90"].includes(sp.periode ?? "") ? sp.periode! : "";
  const statut = ["confirmed", "cancelled", "noshow", "blocked"].includes(sp.statut ?? "") ? sp.statut! : "";
  const tz = ctx.business.timezone;
  const term = clientWord(ctx.business.businessType);
  const terms = clientWord(ctx.business.businessType, { plural: true });
  // Dossier de soins (kinés…) : grille de sélection des patients.
  const patient = isPatientProfession(ctx.business.businessType);
  const sexe = patient && ["F", "M", "X"].includes(sp.sexe ?? "") ? sp.sexe! : "";
  const age = patient && ["mineurs", "adultes", "seniors"].includes(sp.age ?? "") ? sp.age! : "";
  const dossier = patient && ["actifs", "archives"].includes(sp.dossier ?? "") ? sp.dossier! : "";
  const pathologie = patient && ["courante", "E", "Fa", "Fb", "perinatal", "palliatif", "11bis", "autre"].includes(sp.pathologie ?? "") ? sp.pathologie! : "";
  const prescripteur = patient ? (sp.prescripteur ?? "").trim().slice(0, 80) : "";

  // Dernier rendez-vous de chaque fiche (statut, membre, date) et nombre total, en une requête.
  // Colonne qualifiée en clair : dans un select sur une seule table, Drizzle écrit « "id" », ambigu dans les sous-requêtes.
  const cid = sql.raw(`"customers"."id"`);
  const last = sql`(select a.starts_at from appointments a where a.customer_id = ${cid} and a.kind = 'appointment' order by a.starts_at desc limit 1)`;
  const where: SQL[] = [eq(customers.businessId, ctx.business.id)];
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    // Un NISS valide tapé dans la recherche retrouve le patient par son empreinte (le NISS n'est jamais en clair en base).
    const niss = normalizeNiss(q);
    const byNiss = niss && validNiss(niss) ? eq(customers.nissHash, blindIndex(niss, "niss")) : undefined;
    // Date de naissance (jj/mm/aaaa ou aaaa-mm-jj) et adresse : recherche des dossiers patients.
    const dm = q.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/) ?? null;
    const iso = dm ? `${dm[3]}-${dm[2]!.padStart(2, "0")}-${dm[1]!.padStart(2, "0")}` : /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : null;
    const byBirth = iso ? eq(customers.birthDate, iso) : undefined;
    where.push(or(ilike(customers.fullName, like), ilike(customers.email, like), ilike(customers.phone, like), ilike(customers.altName, like), ilike(customers.altEmail, like), ilike(customers.altPhone, like), ilike(customers.street, like), ilike(customers.city, like), ilike(customers.postalCode, like), byNiss, byBirth)!);
  }
  if (sexe) where.push(eq(customers.sex, sexe));
  if (age === "mineurs") where.push(sql`${customers.birthDate} > (current_date - interval '18 years')`);
  else if (age === "adultes") where.push(sql`${customers.birthDate} <= (current_date - interval '18 years') and ${customers.birthDate} > (current_date - interval '65 years')`);
  else if (age === "seniors") where.push(sql`${customers.birthDate} <= (current_date - interval '65 years')`);
  if (dossier === "actifs") where.push(sql`${customers.archivedAt} is null`);
  else if (dossier === "archives") where.push(sql`${customers.archivedAt} is not null`);
  if (pathologie) where.push(sql`exists (select 1 from care_episodes e where e.customer_id = ${cid} and e.status = 'open' and e.pathology_kind = ${pathologie})`);
  if (prescripteur) {
    const pl = `%${prescripteur.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    where.push(sql`(${customers.prescriberName} ilike ${pl} or exists (select 1 from care_episodes e where e.customer_id = ${cid} and e.prescriber_name ilike ${pl}))`);
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

  const filtered = !!(q || periode || statut || sexe || age || dossier || pathologie || prescripteur);
  // Skydev : import depuis un autre logiciel (CSV / Excel).
  const canImport = ctx.can("customers.manage") && (await currentBrand()).id === "skydev";
  const inboxCount = patient && ctx.can("records.view") ? ((await db.execute<{ n: number }>(sql`select count(*)::int as n from care_inbox where business_id = ${ctx.business.id} and status = 'pending'`))[0]?.n ?? 0) : null;
  return (
    <>
      <PageHeader
        title={clientWord(ctx.business.businessType, { plural: true, capitalize: true })}
        description={filtered ? `${rows.length} résultat${rows.length > 1 ? "s" : ""}` : `${rows.length}${rows.length === 300 ? "+" : ""} ${rows.length > 1 ? terms : term}`}
        action={ctx.can("customers.manage") || inboxCount != null ? <div className="flex flex-wrap gap-2">{inboxCount != null ? <ButtonLink href="/app/clients/reception" variant="ghost" icon={<Inbox className="size-4" aria-hidden="true" />}>Boîte de réception{inboxCount ? ` (${inboxCount})` : ""}</ButtonLink> : null}{canImport ? <ButtonLink href="/app/clients/importer" variant="ghost" icon={<FileUp className="size-4" aria-hidden="true" />}>Importer</ButtonLink> : null}{canImport ? <a href="/app/clients/export" download className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface-muted hover:text-text"><Download className="size-4" aria-hidden="true" />Exporter</a> : null}{ctx.can("customers.manage") ? <ButtonLink href="/app/clients?nouveau=1" variant="secondary" icon={<UserPlus className="size-4" aria-hidden="true" />}>Ajouter un {term}</ButtonLink> : null}</div> : null}
      />
      {sp.nouveau && ctx.can("customers.manage") ? <NewCustomerForm key="new" term={term} initialOpen /> : null}

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input name="q" defaultValue={q} placeholder={patient ? "Nom, NISS, date de naissance, adresse…" : t("Nom, email ou téléphone")} className="pl-9" aria-label={`Rechercher un ${term}`} />
        </div>
        <Select name="periode" defaultValue={periode} className="w-auto" aria-label={t("Période")}>
          <option value="">{t("Toutes les dates")}</option>
          <option value="avenir">{t("RDV à venir")}</option>
          <option value="7">{t("Venus ces 7 jours")}</option>
          <option value="30">{t("Venus ces 30 jours")}</option>
          <option value="90">{t("Venus ces 90 jours")}</option>
        </Select>
        <Select name="statut" defaultValue={statut} className="w-auto" aria-label="Statut">
          <option value="">{t("Tous les statuts")}</option>
          <option value="confirmed">{t("Dernier RDV confirmé")}</option>
          <option value="cancelled">{t("Dernier RDV annulé")}</option>
          <option value="noshow">{t("Au moins une absence")}</option>
          <option value="blocked">Bloqués</option>
        </Select>
        {patient ? (
          <>
            <Select name="dossier" defaultValue={dossier} className="w-auto" aria-label="Dossier">
              <option value="">Tous les dossiers</option>
              <option value="actifs">Dossiers actifs</option>
              <option value="archives">Dossiers archivés</option>
            </Select>
            <Select name="pathologie" defaultValue={pathologie} className="w-auto" aria-label="Pathologie en cours">
              <option value="">Toutes situations</option>
              <option value="courante">Pathologie courante</option>
              <option value="E">Liste E</option>
              <option value="Fa">Liste Fa</option>
              <option value="Fb">Liste Fb</option>
              <option value="perinatal">Périnatal</option>
              <option value="palliatif">Palliatif</option>
              <option value="11bis">Situation 11bis</option>
              <option value="autre">Autre situation</option>
            </Select>
            <Select name="sexe" defaultValue={sexe} className="w-auto" aria-label="Sexe">
              <option value="">Tous sexes</option>
              <option value="F">Femmes</option>
              <option value="M">Hommes</option>
              <option value="X">X</option>
            </Select>
            <Select name="age" defaultValue={age} className="w-auto" aria-label="Âge">
              <option value="">Tous âges</option>
              <option value="mineurs">Moins de 18 ans</option>
              <option value="adultes">18 à 64 ans</option>
              <option value="seniors">65 ans et plus</option>
            </Select>
            <Input name="prescripteur" defaultValue={prescripteur} placeholder="Prescripteur" className="w-44" aria-label="Prescripteur" />
          </>
        ) : null}
        <button type="submit" className="h-10 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted">Filtrer</button>
      </form>

      <Card className="overflow-hidden">
        <CustomersTable
          term={term}
          filtered={filtered}
          canDelete={ctx.can("customers.manage")}
          rows={rows.map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, blocked: !!r.blockedAt, count: r.count, last: r.lastAt ? formatDay(r.lastAt, tz, "d MMM yyyy", t.locale) : null, lastStatus: r.lastStatus, member: r.lastMember }))}
        />
      </Card>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { and, asc, count, desc, eq, gte, ilike, isNull, lt, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { appointments, members } from "@/db/schema";
import { HistoryTable } from "@/components/agenda/history-table";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { clientWord } from "@/lib/terminology";
import { formatDay, formatTime } from "@/lib/time";
import { requireContext } from "@/server/context";
import { effectivePlan } from "@/server/plan";
import { limitOf } from "@/lib/plans";
import { UpgradeNotice } from "@/components/app/upgrade-notice";

export const metadata: Metadata = { title: "Historique" };

const PER_PAGE = 30;
type SearchParams = Promise<{ q?: string; statut?: string; periode?: string; membre?: string; page?: string }>;

export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireContext("appointments.view");
  const bid = ctx.business.id;
  const tz = ctx.business.timezone;
  const p = await searchParams;
  const now = new Date();
  const q = p.q?.trim().slice(0, 80) ?? "";
  const statut = ["confirme", "termine", "annule", "absent", "attente"].includes(p.statut ?? "") ? p.statut! : "";
  const periode = ["7", "30", "90", "avenir"].includes(p.periode ?? "") ? p.periode! : "";
  const page = Math.max(1, Number(p.page) || 1);

  const team = await db.select({ id: members.id, name: members.displayName }).from(members).where(eq(members.businessId, bid)).orderBy(asc(members.createdAt));
  const membre = team.some((m) => m.id === p.membre) ? p.membre! : "";

  const where: SQL[] = [eq(appointments.businessId, bid), eq(appointments.kind, "appointment"), isNull(appointments.groupSessionId)];
  // Historique : limité selon le forfait (les rendez-vous ne sont jamais supprimés).
  const historyDays = limitOf((await effectivePlan(bid)).plan, "historyDays");
  if (Number.isFinite(historyDays)) where.push(gte(appointments.startsAt, new Date(now.getTime() - historyDays * 86400000)));
  if (statut === "confirme") where.push(eq(appointments.status, "confirmed"), gte(appointments.endsAt, now));
  if (statut === "termine") where.push(eq(appointments.status, "confirmed"), lt(appointments.endsAt, now), eq(appointments.noShow, false));
  if (statut === "annule") where.push(eq(appointments.status, "cancelled"));
  if (statut === "absent") where.push(eq(appointments.noShow, true));
  if (statut === "attente") where.push(eq(appointments.status, "pending"));
  if (periode === "avenir") where.push(gte(appointments.startsAt, now));
  else if (periode) where.push(gte(appointments.startsAt, new Date(now.getTime() - Number(periode) * 86400000)), lt(appointments.startsAt, now));
  if (membre) where.push(eq(appointments.memberId, membre));
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(appointments.contactName, like), ilike(appointments.contactEmail, like), ilike(appointments.contactPhone, like), ilike(appointments.serviceName, like))!);
  }

  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    db
      .select({ a: appointments, memberName: members.displayName })
      .from(appointments)
      .leftJoin(members, eq(members.id, appointments.memberId))
      .where(and(...where))
      .orderBy(desc(appointments.startsAt))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db.select({ total: count() }).from(appointments).where(and(...where)),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const state = (a: (typeof rows)[number]["a"]) =>
    a.status === "cancelled" ? "annule" : a.status === "pending" ? "attente" : a.noShow ? "absent" : a.endsAt < now ? "termine" : "confirme";

  const link = (patch: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    const merged = { q, statut, periode, membre, page: String(page), ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === "1")) sp.set(k, v);
    return `/app/historique${sp.size ? `?${sp}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Historique" description={`${total} rendez-vous`} />
      {Number.isFinite(historyDays) ? <div className="mb-4"><UpgradeNotice feature="Historique complet" required="pro">Avec votre forfait, l&apos;historique affiche les {historyDays} derniers jours. Rien n&apos;est supprimé : tout réapparaît en passant au forfait Pro.</UpgradeNotice></div> : null}
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input name="q" defaultValue={q} placeholder={`Nom du ${clientWord(ctx.business.businessType)}, email, téléphone, prestation…`} className="pl-9" aria-label="Rechercher" />
        </div>
        <Select name="statut" defaultValue={statut} aria-label="Statut" className="w-auto">
          <option value="">Tous les statuts</option>
          <option value="confirme">Confirmés (à venir)</option>
          <option value="termine">Terminés</option>
          <option value="attente">En attente</option>
          <option value="annule">Annulés</option>
          <option value="absent">Absences</option>
        </Select>
        <Select name="periode" defaultValue={periode} aria-label="Période" className="w-auto">
          <option value="">Toutes les dates</option>
          <option value="avenir">À venir</option>
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
        </Select>
        {team.length > 1 ? (
          <Select name="membre" defaultValue={membre} aria-label="Membre" className="w-auto">
            <option value="">Toute l&apos;équipe</option>
            {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        ) : null}
        <button type="submit" className="h-10 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted">Filtrer</button>
      </form>

      <Card className="overflow-hidden">
        <HistoryTable
          canDelete={ctx.can("appointments.cancel")}
          rows={rows.map(({ a, memberName }) => ({
            id: a.id,
            name: a.contactName ?? "—",
            customerId: a.customerId,
            service: a.serviceName ?? "Sans prestation",
            member: memberName ?? "—",
            when: `${formatDay(a.startsAt, tz, "d MMM yyyy")} · ${formatTime(a.startsAt, tz)}`,
            state: state(a),
          }))}
        />
      </Card>

      {pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={link({ page: page - 1 })} className="font-medium text-accent hover:text-accent-hover">← Précédent</Link> : <span />}
          <span className="text-muted">Page {page} sur {pages}</span>
          {page < pages ? <Link href={link({ page: page + 1 })} className="font-medium text-accent hover:text-accent-hover">Suivant →</Link> : <span />}
        </nav>
      ) : null}
    </>
  );
}

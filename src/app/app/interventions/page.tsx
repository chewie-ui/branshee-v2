import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { InterventionsList } from "@/components/interventions/interventions-list";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { interventionRights, listInterventions } from "@/server/interventions";
import { teamOf } from "@/server/projects";

export const metadata: Metadata = { title: "Interventions" };

export default async function InterventionsPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const ctx = await requireContext();
  const rights = interventionRights(ctx);
  const view = (await searchParams).vue === "terminees" ? "done" : (await searchParams).vue === "moi" ? "mine" : "todo";
  const [rows, team, clients] = await Promise.all([
    view === "done" ? listInterventions(ctx.business.id, {}) : listInterventions(ctx.business.id, { done: false, technicianId: view === "mine" ? ctx.member.id : undefined }),
    teamOf(ctx.business.id),
    rights.manage ? db.select({ id: customers.id, name: customers.fullName, company: customers.companyName }).from(customers).where(eq(customers.businessId, ctx.business.id)).orderBy(asc(customers.fullName)).limit(3000) : Promise.resolve([]),
  ]);
  const list = (view === "done" ? rows.filter((r) => r.i.status === "done" || r.i.status === "cancelled") : rows.filter((r) => r.i.status !== "cancelled")).map(({ i, tech }) => ({ id: i.id, number: i.number, title: i.title, client: i.clientName, address: i.address, status: i.status, scheduledAt: i.scheduledAt?.toISOString() ?? null, tech, techId: i.technicianId, signed: !!i.signedAt, invoiced: !!i.invoiceId }));
  return (
    <>
      <PageHeader title="Interventions" description="Vos techniciens sur le terrain : planning, bons d'intervention signés, facturation." />
      <InterventionsList rows={list} view={view} team={team} clients={clients.map((c) => ({ id: c.id, name: c.company ? `${c.company} (${c.name})` : c.name }))} canManage={rights.manage} tz={ctx.business.timezone || "Europe/Brussels"} />
    </>
  );
}

import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { ProjectsList } from "@/components/projects/projects-list";
import { PageHeader } from "@/components/ui/page-header";
import { todayIn } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { listProjects, projectRights } from "@/server/projects";

export const metadata: Metadata = { title: "Projets" };

export default async function ProjectsPage() {
  const ctx = await requireContext();
  const rights = projectRights(ctx);
  const [list, clients] = await Promise.all([
    listProjects(ctx.business.id),
    rights.manage ? db.select({ id: customers.id, name: customers.fullName, company: customers.companyName }).from(customers).where(eq(customers.businessId, ctx.business.id)).orderBy(asc(customers.fullName)).limit(3000) : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader title="Projets" description="Vos projets et chantiers : tâches, temps passé et facturation." />
      <ProjectsList projects={list.map((p) => (rights.manage ? p : { ...p, hourlyRateCents: 0 }))} customers={clients.map((c) => ({ id: c.id, name: c.company ? `${c.company} (${c.name})` : c.name }))} canManage={rights.manage} today={todayIn(ctx.business.timezone)} />
    </>
  );
}

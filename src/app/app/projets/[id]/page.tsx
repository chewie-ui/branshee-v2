import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { ProjectBoard } from "@/components/projects/project-board";
import { todayIn } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { projectDetail, projectRights, teamOf } from "@/server/projects";

export const metadata: Metadata = { title: "Projet" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireContext();
  const rights = projectRights(ctx);
  const [detail, team, clients] = await Promise.all([
    projectDetail(ctx.business.id, id),
    teamOf(ctx.business.id),
    rights.manage ? db.select({ id: customers.id, name: customers.fullName, company: customers.companyName }).from(customers).where(eq(customers.businessId, ctx.business.id)).orderBy(asc(customers.fullName)).limit(3000) : Promise.resolve([]),
  ]);
  if (!detail) notFound();
  const project = rights.manage ? detail.project : { ...detail.project, hourlyRateCents: 0 };
  return (
    <ProjectBoard
      project={project}
      tasks={detail.tasks}
      entries={detail.entries}
      team={team}
      me={ctx.member.id}
      today={todayIn(ctx.business.timezone)}
      canManage={rights.manage}
      canInvoice={rights.invoice}
      customers={clients.map((c) => ({ id: c.id, name: c.company ? `${c.company} (${c.name})` : c.name }))}
    />
  );
}

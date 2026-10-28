import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, members, projectTasks, projects, timeEntries } from "@/db/schema";
import type { AppContext } from "@/server/context";

/**
 * Toute l'équipe voit les projets, crée et déplace les tâches, note son temps.
 * Créer / modifier un projet, voir les tarifs et facturer : le responsable ou qui gère les factures.
 */
export const projectRights = (ctx: AppContext) => ({ manage: ctx.member.isOwner || ctx.can("invoices.manage"), invoice: ctx.can("invoices.manage") });

/** Temps facturable pas encore repris dans une facture (ou dont le brouillon a été supprimé ou annulé). */
export const unbilled = sql`"time_entries"."billable" and ("time_entries"."invoice_id" is null or not exists (select 1 from sales_documents sd where sd.id = "time_entries"."invoice_id" and sd.status <> 'cancelled'))`;

export type ProjectCard = { id: string; name: string; color: string; status: string; customerName: string | null; customerId: string | null; deadline: string | null; hourlyRateCents: number; budgetMinutes: number | null; description: string | null; tasks: number; done: number; minutes: number; unbilledMinutes: number };

export async function listProjects(businessId: string): Promise<ProjectCard[]> {
  const rows = await db
    .select({
      p: projects,
      customerName: sql<string | null>`coalesce(${customers.companyName}, ${customers.fullName})`,
      tasks: sql<number>`(select count(*)::int from project_tasks t where t.project_id = ${projects.id})`,
      done: sql<number>`(select count(*)::int from project_tasks t where t.project_id = ${projects.id} and t.status = 'done')`,
      minutes: sql<number>`(select coalesce(sum(minutes), 0)::int from time_entries e where e.project_id = ${projects.id})`,
      unbilledMinutes: sql<number>`(select coalesce(sum(e.minutes), 0)::int from time_entries e where e.project_id = ${projects.id} and e.billable and (e.invoice_id is null or not exists (select 1 from sales_documents sd where sd.id = e.invoice_id and sd.status <> 'cancelled')))`,
    })
    .from(projects)
    .leftJoin(customers, eq(customers.id, projects.customerId))
    .where(eq(projects.businessId, businessId))
    .orderBy(asc(projects.status), asc(projects.deadline), desc(projects.updatedAt))
    .limit(500);
  return rows.map(({ p, ...r }) => ({ id: p.id, name: p.name, color: p.color, status: p.status, customerId: p.customerId, deadline: p.deadline, hourlyRateCents: p.hourlyRateCents, budgetMinutes: p.budgetMinutes, description: p.description, ...r }));
}

export async function teamOf(businessId: string) {
  return db.select({ id: members.id, name: members.displayName }).from(members).where(and(eq(members.businessId, businessId), eq(members.status, "active"), eq(members.isActive, true))).orderBy(asc(members.displayName));
}

export type TaskView = { id: string; projectId: string; title: string; description: string | null; status: string; assigneeMemberId: string | null; dueDate: string | null; estimateMinutes: number | null; minutes: number };
export type EntryView = { id: string; taskId: string | null; memberId: string | null; memberName: string | null; day: string; minutes: number; note: string | null; billable: boolean; billed: boolean };

export async function projectDetail(businessId: string, id: string) {
  const [card] = (await listProjects(businessId)).filter((p) => p.id === id);
  if (!card) return null;
  const [tasks, entries] = await Promise.all([
    db
      .select({ t: projectTasks, minutes: sql<number>`(select coalesce(sum(minutes), 0)::int from time_entries e where e.task_id = "project_tasks"."id")` })
      .from(projectTasks)
      .where(and(eq(projectTasks.projectId, id), eq(projectTasks.businessId, businessId)))
      .orderBy(asc(projectTasks.position), asc(projectTasks.createdAt)),
    db
      .select({ e: timeEntries, memberName: members.displayName, billed: sql<boolean>`not (${unbilled})` })
      .from(timeEntries)
      .leftJoin(members, eq(members.id, timeEntries.memberId))
      .where(and(eq(timeEntries.projectId, id), eq(timeEntries.businessId, businessId)))
      .orderBy(desc(timeEntries.day), desc(timeEntries.createdAt))
      .limit(1000),
  ]);
  return {
    project: card,
    tasks: tasks.map(({ t, minutes }): TaskView => ({ id: t.id, projectId: t.projectId, title: t.title, description: t.description, status: t.status, assigneeMemberId: t.assigneeMemberId, dueDate: t.dueDate, estimateMinutes: t.estimateMinutes, minutes })),
    entries: entries.map(({ e, memberName, billed }): EntryView => ({ id: e.id, taskId: e.taskId, memberId: e.memberId, memberName, day: e.day, minutes: e.minutes, note: e.note, billable: e.billable, billed: e.billable && billed })),
  };
}

/** Tâches ouvertes d'une personne, tous projets actifs confondus. */
export async function tasksOf(businessId: string, memberId: string) {
  return db
    .select({ id: projectTasks.id, title: projectTasks.title, status: projectTasks.status, dueDate: projectTasks.dueDate, projectId: projects.id, projectName: projects.name, color: projects.color })
    .from(projectTasks)
    .innerJoin(projects, eq(projects.id, projectTasks.projectId))
    .where(and(eq(projectTasks.businessId, businessId), eq(projectTasks.assigneeMemberId, memberId), ne(projectTasks.status, "done"), eq(projects.status, "active")))
    .orderBy(sql`${projectTasks.dueDate} asc nulls last`, asc(projectTasks.createdAt))
    .limit(300);
}

/** Temps d'une personne sur une période (feuille de temps). */
export async function entriesOf(businessId: string, memberId: string, from: string, to: string) {
  return db
    .select({ id: timeEntries.id, day: timeEntries.day, minutes: timeEntries.minutes, note: timeEntries.note, projectId: projects.id, projectName: projects.name, color: projects.color, taskTitle: projectTasks.title, billed: sql<boolean>`not (${unbilled})` })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .leftJoin(projectTasks, eq(projectTasks.id, timeEntries.taskId))
    .where(and(eq(timeEntries.businessId, businessId), eq(timeEntries.memberId, memberId), sql`${timeEntries.day} between ${from} and ${to}`))
    .orderBy(asc(timeEntries.day), asc(timeEntries.createdAt));
}

export async function activeProjectsWithTasks(businessId: string) {
  const ps = await db.select({ id: projects.id, name: projects.name }).from(projects).where(and(eq(projects.businessId, businessId), eq(projects.status, "active"))).orderBy(asc(projects.name));
  const ts = ps.length ? await db.select({ id: projectTasks.id, projectId: projectTasks.projectId, title: projectTasks.title }).from(projectTasks).where(and(inArray(projectTasks.projectId, ps.map((p) => p.id)), ne(projectTasks.status, "done"))).orderBy(asc(projectTasks.position)) : [];
  return ps.map((p) => ({ ...p, tasks: ts.filter((t) => t.projectId === p.id).map((t) => ({ id: t.id, title: t.title })) }));
}

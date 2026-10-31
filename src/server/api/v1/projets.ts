import "server-only";
import { headers } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { deleteProject, deleteTask, deleteTime, invoiceProjectTime, logTime, moveTask, saveProject, saveTask, setProjectStatus } from "@/server/actions/projects";
import { fail, forbidden, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { isLocked } from "@/server/plan";
import { activeProjectsWithTasks, entriesOf, listProjects, projectDetail, projectRights, tasksOf, teamOf } from "@/server/projects";
import { addDays, isDay, mondayOf, todayIn, weekDays } from "@/lib/planning";

/** API mobile de l'app Projets (Skydev) : projets, tâches (tableau), temps passé, feuille de temps, facturation du temps. */

async function needProjets(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("projets")) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const ok = <T extends { ok: boolean }>(r: T) => {
  const e = r as { ok: boolean; error?: string };
  if (!e.ok) return invalid(e.error ?? "Action impossible.");
  return r as T & { id?: string; message?: string; url?: string };
};
const msg = (r: { message?: string }) => ({ ok: true, message: r.message ?? null });

async function customersOf(ctx: AppContext) {
  if (!projectRights(ctx).manage) return [];
  const rows = await db.select({ id: customers.id, name: customers.fullName, company: customers.companyName }).from(customers).where(eq(customers.businessId, ctx.business.id)).orderBy(asc(customers.fullName)).limit(3000);
  return rows.map((c) => ({ id: c.id, name: c.company ? `${c.company} (${c.name})` : c.name }));
}

function projectInput(b: Record<string, unknown>, id?: string) {
  return {
    id,
    name: str(b.name, 120),
    description: str(b.description, 1000),
    customerId: uuid(b.customerId) ? (b.customerId as string) : "",
    color: str(b.color, 20) || "indigo",
    rate: str(b.rate, 12) || "0",
    budgetHours: str(b.budgetHours, 12),
    deadline: isDay(b.deadline) ? b.deadline : "",
  };
}

function taskInput(b: Record<string, unknown>, projectId: string, id?: string) {
  const est = b.estimateMinutes;
  return {
    id,
    projectId,
    title: str(b.title, 200),
    description: str(b.description, 4000),
    status: str(b.status, 20) || "todo",
    assigneeMemberId: uuid(b.assigneeMemberId) ? (b.assigneeMemberId as string) : "",
    dueDate: isDay(b.dueDate) ? b.dueDate : "",
    estimateMinutes: est == null || est === "" ? ("" as const) : Math.max(0, Math.round(Number(est) || 0)),
  };
}

async function list() {
  const ctx = await needProjets();
  const rights = projectRights(ctx);
  const [rows, clients] = await Promise.all([listProjects(ctx.business.id), customersOf(ctx)]);
  return { canManage: rights.manage, canInvoice: rights.invoice, today: todayIn(ctx.business.timezone), customers: clients, projects: rights.manage ? rows : rows.map((p) => ({ ...p, hourlyRateCents: 0 })) };
}

async function detail(r: ApiRequest) {
  const ctx = await needProjets();
  if (!uuid(r.params.id)) return fail(404, "not_found", "Projet introuvable.");
  const rights = projectRights(ctx);
  const [d, team, clients] = await Promise.all([projectDetail(ctx.business.id, r.params.id!), teamOf(ctx.business.id), customersOf(ctx)]);
  if (!d) return fail(404, "not_found", "Projet introuvable.");
  return { ...d, project: rights.manage ? d.project : { ...d.project, hourlyRateCents: 0 }, team, customers: clients, me: ctx.member.id, today: todayIn(ctx.business.timezone), canManage: rights.manage, canInvoice: rights.invoice };
}

async function timesheet(r: ApiRequest) {
  const ctx = await needProjets();
  const today = todayIn(ctx.business.timezone);
  const q = r.query.get("week");
  const monday = mondayOf(isDay(q) ? q : today);
  const days = weekDays(monday);
  const [entries, projects] = await Promise.all([entriesOf(ctx.business.id, ctx.member.id, days[0]!, days[6]!), activeProjectsWithTasks(ctx.business.id)]);
  return { today, monday, prev: addDays(monday, -7), next: addDays(monday, 7), days, entries: entries.map((e) => ({ ...e, billed: !!e.billed })), projects };
}

export const projetsRoutes: Route[] = [
  { method: "GET", path: "/projects", handler: list },
  {
    method: "GET",
    path: "/projects/my-tasks",
    handler: async () => {
      const ctx = await needProjets();
      return { today: todayIn(ctx.business.timezone), tasks: await tasksOf(ctx.business.id, ctx.member.id) };
    },
  },
  { method: "GET", path: "/projects/timesheet", handler: timesheet },
  {
    method: "POST",
    path: "/projects",
    handler: async (r) => {
      await needProjets();
      const res = ok(await saveProject(projectInput(r.body)));
      return { ok: true, id: res.id ?? null };
    },
  },
  { method: "GET", path: "/projects/:id", handler: detail },
  {
    method: "PATCH",
    path: "/projects/:id",
    handler: async (r) => {
      await needProjets();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Projet introuvable.");
      return msg(ok(await saveProject(projectInput(r.body, r.params.id!))));
    },
  },
  {
    method: "PATCH",
    path: "/projects/:id/status",
    handler: async (r) => {
      await needProjets();
      return msg(ok(await setProjectStatus(r.params.id!, str(r.body.status, 20))));
    },
  },
  {
    method: "DELETE",
    path: "/projects/:id",
    handler: async (r) => {
      await needProjets();
      return msg(ok(await deleteProject(r.params.id!)));
    },
  },
  {
    method: "POST",
    path: "/projects/:id/tasks",
    handler: async (r) => {
      await needProjets();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Projet introuvable.");
      return msg(ok(await saveTask(taskInput(r.body, r.params.id!))));
    },
  },
  {
    method: "PATCH",
    path: "/project-tasks/:id",
    handler: async (r) => {
      await needProjets();
      if (!uuid(r.params.id) || !uuid(r.body.projectId)) return fail(404, "not_found", "Tâche introuvable.");
      return msg(ok(await saveTask(taskInput(r.body, r.body.projectId as string, r.params.id!))));
    },
  },
  {
    method: "PATCH",
    path: "/project-tasks/:id/move",
    handler: async (r) => {
      await needProjets();
      return msg(ok(await moveTask(r.params.id!, str(r.body.status, 20))));
    },
  },
  {
    method: "DELETE",
    path: "/project-tasks/:id",
    handler: async (r) => {
      await needProjets();
      return msg(ok(await deleteTask(r.params.id!)));
    },
  },
  {
    method: "POST",
    path: "/projects/:id/time",
    handler: async (r) => {
      await needProjets();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Projet introuvable.");
      const b = r.body;
      return msg(
        ok(
          await logTime({
            projectId: r.params.id!,
            taskId: uuid(b.taskId) ? (b.taskId as string) : "",
            memberId: uuid(b.memberId) ? (b.memberId as string) : "",
            day: str(b.day, 10),
            minutes: Math.round(Number(b.minutes) || 0),
            note: str(b.note, 300),
            billable: b.billable !== false,
          }),
        ),
      );
    },
  },
  {
    method: "DELETE",
    path: "/project-time/:id",
    handler: async (r) => {
      await needProjets();
      return msg(ok(await deleteTime(r.params.id!)));
    },
  },
  {
    method: "POST",
    path: "/projects/:id/invoice",
    handler: async (r) => {
      await needProjets();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Projet introuvable.");
      const res = ok(await invoiceProjectTime(r.params.id!));
      return { ok: true, message: res.message ?? null, invoiceId: res.url?.split("/").pop() ?? null };
    },
  },
];

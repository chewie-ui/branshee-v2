import "server-only";
import { headers } from "next/headers";
import { addTask, archiveList, deleteTask, saveList, toggleTask, updateTask } from "@/server/actions/todos";
import { fail, forbidden, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { todayIn } from "@/lib/planning";
import { isLocked } from "@/server/plan";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { todoTasks } from "@/db/schema";
import { canSeeTask, listMembersOf, tasksFor, teamOf, visibleLists, type TodoView } from "@/server/todos";

/** API mobile de l'app Tâches (Skydev) : mêmes vues et actions que /app/taches. */

async function needTaches(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("taches")) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const ok = <T extends { ok: boolean }>(r: T) => {
  const e = r as { ok: boolean; error?: string };
  if (!e.ok) return invalid(e.error ?? "Action impossible.");
  return r as T & { id?: string };
};

async function view(r: ApiRequest) {
  const ctx = await needTaches();
  const v = r.query.get("view") ?? "today";
  const listId = r.query.get("listId");
  const kind: TodoView = v === "inbox" ? { kind: "inbox" } : v === "upcoming" ? { kind: "upcoming" } : v === "assigned" ? { kind: "assigned" } : v === "list" && uuid(listId) ? { kind: "list", id: listId! } : { kind: "today" };
  const today = todayIn(ctx.business.timezone);
  const [{ top, subs }, lists, team] = await Promise.all([tasksFor(ctx, kind, today, r.query.get("done") === "1"), visibleLists(ctx), teamOf(ctx.business.id)]);
  const dto = (t: (typeof top)[number]) => ({ id: t.id, title: t.title, notes: t.notes ?? "", dueDate: t.dueDate, dueTime: t.dueTime, priority: t.priority, recurrence: t.recurrence, listId: t.listId, parentId: t.parentId, assigneeId: t.assignee, createdById: t.createdBy, done: !!t.completedAt });
  return {
    today,
    me: ctx.member.id,
    tasks: top.map((t) => ({ ...dto(t), subtasks: subs.filter((s) => s.parentId === t.id).map(dto) })),
    lists: lists.map((l) => ({ id: l.id, name: l.name, color: l.color, visibility: l.visibility, open: l.open, mine: l.createdBy === ctx.member.id })),
    team: team.map((m) => ({ id: m.id, name: m.name })),
  };
}

export const tachesRoutes: Route[] = [
  { method: "GET", path: "/tasks", handler: view },
  {
    method: "POST",
    path: "/tasks",
    handler: async (r) => {
      await needTaches();
      const res = ok(await addTask({ text: str(r.body.text, 500), listId: uuid(r.body.listId) ? (r.body.listId as string) : null, parentId: uuid(r.body.parentId) ? (r.body.parentId as string) : null, dueDate: str(r.body.dueDate, 10) || null }));
      return { ok: true, id: res.id ?? null };
    },
  },
  {
    method: "GET",
    path: "/tasks/:id",
    handler: async (r) => {
      const ctx = await needTaches();
      const t = await canSeeTask(ctx, r.params.id!);
      if (!t) return fail(404, "not_found", "Tâche introuvable.");
      const subs = await db.select().from(todoTasks).where(and(eq(todoTasks.businessId, ctx.business.id), eq(todoTasks.parentId, t.id))).orderBy(asc(todoTasks.completedAt), asc(todoTasks.position), asc(todoTasks.createdAt));
      const dto = (x: typeof t) => ({ id: x.id, title: x.title, notes: x.notes ?? "", dueDate: x.dueDate, dueTime: x.dueTime, priority: x.priority, recurrence: x.recurrence, listId: x.listId, parentId: x.parentId, assigneeId: x.assigneeMemberId, createdById: x.createdByMemberId, done: !!x.completedAt });
      const [lists, team] = await Promise.all([visibleLists(ctx), teamOf(ctx.business.id)]);
      return { task: { ...dto(t), subtasks: subs.map(dto) }, lists: lists.map((l) => ({ id: l.id, name: l.name, color: l.color })), team: team.map((m) => ({ id: m.id, name: m.name })), me: ctx.member.id };
    },
  },
  {
    method: "PATCH",
    path: "/tasks/:id",
    handler: async (r) => {
      await needTaches();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Tâche introuvable.");
      const b = r.body;
      const pick = <T>(k: string, f: (v: unknown) => T) => (k in b ? f(b[k]) : undefined);
      ok(
        await updateTask(r.params.id!, {
          title: pick("title", (v) => str(v, 300)),
          notes: pick("notes", (v) => str(v, 5000)),
          dueDate: pick("dueDate", (v) => (v ? str(v, 10) : null)),
          dueTime: pick("dueTime", (v) => (v ? str(v, 5) : null)),
          priority: pick("priority", (v) => Number(v) || 4),
          recurrence: pick("recurrence", (v) => (v ? (str(v, 20) as "daily") : null)),
          assigneeId: pick("assigneeId", (v) => (v ? str(v, 40) : null)),
          listId: pick("listId", (v) => (v ? str(v, 40) : null)),
        }),
      );
      return { ok: true };
    },
  },
  {
    method: "POST",
    path: "/tasks/:id/toggle",
    handler: async (r) => {
      await needTaches();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Tâche introuvable.");
      return ok(await toggleTask(r.params.id!));
    },
  },
  {
    method: "DELETE",
    path: "/tasks/:id",
    handler: async (r) => {
      await needTaches();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Tâche introuvable.");
      return ok(await deleteTask(r.params.id!));
    },
  },
  {
    method: "GET",
    path: "/task-lists/:id/members",
    handler: async (r) => {
      await needTaches();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Liste introuvable.");
      return { memberIds: await listMembersOf(r.params.id!) };
    },
  },
  {
    method: "POST",
    path: "/task-lists",
    handler: async (r) => {
      await needTaches();
      const b = r.body;
      const res = ok(
        await saveList({
          id: uuid(b.id) ? (b.id as string) : undefined,
          name: str(b.name, 60),
          color: (str(b.color, 20) || "slate") as "slate",
          visibility: b.visibility === "private" ? "private" : b.visibility === "members" ? "members" : "team",
          memberIds: Array.isArray(b.memberIds) ? (b.memberIds as unknown[]).filter(uuid) as string[] : [],
        }),
      );
      return { ok: true, id: res.id ?? null };
    },
  },
  {
    method: "DELETE",
    path: "/task-lists/:id",
    handler: async (r) => {
      await needTaches();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Liste introuvable.");
      return ok(await archiveList(r.params.id!));
    },
  },
];

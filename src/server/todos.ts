import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { members, todoListMembers, todoLists, todoTasks } from "@/db/schema";
import type { AppContext } from "@/server/context";

export type TodoView = { kind: "inbox" } | { kind: "today" } | { kind: "upcoming" } | { kind: "list"; id: string } | { kind: "assigned" };

/** Listes visibles par ce membre : celles de l'équipe, les siennes, celles où il a été ajouté. */
export async function visibleLists(ctx: AppContext) {
  const me = ctx.member.id;
  return db
    .select({ id: todoLists.id, name: todoLists.name, color: todoLists.color, visibility: todoLists.visibility, createdBy: todoLists.createdByMemberId, open: sql<number>`(select count(*)::int from "todo_tasks" t where t.list_id = "todo_lists"."id" and t.completed_at is null and t.parent_id is null)` })
    .from(todoLists)
    .where(
      and(
        eq(todoLists.businessId, ctx.business.id),
        isNull(todoLists.archivedAt),
        or(eq(todoLists.visibility, "team"), eq(todoLists.createdByMemberId, me), sql`exists (select 1 from "todo_list_members" lm where lm.list_id = "todo_lists"."id" and lm.member_id = ${me})`),
      ),
    )
    .orderBy(asc(todoLists.position), asc(todoLists.createdAt));
}

export async function listMembersOf(listId: string) {
  return (await db.select({ id: todoListMembers.memberId }).from(todoListMembers).where(eq(todoListMembers.listId, listId))).map((r) => r.id);
}

/** Condition « tâche visible par moi » (boîte de réception à soi, listes visibles, ou tâche confiée). */
export function visibleTask(ctx: AppContext, listIds: string[]): SQL {
  const me = ctx.member.id;
  return and(
    eq(todoTasks.businessId, ctx.business.id),
    or(
      and(isNull(todoTasks.listId), or(eq(todoTasks.createdByMemberId, me), eq(todoTasks.assigneeMemberId, me))),
      listIds.length ? inArray(todoTasks.listId, listIds) : sql`false`,
      eq(todoTasks.assigneeMemberId, me),
    ),
  )!;
}

export async function canSeeTask(ctx: AppContext, taskId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) return null;
  const lists = (await visibleLists(ctx)).map((l) => l.id);
  const [t] = await db.select().from(todoTasks).where(and(eq(todoTasks.id, taskId), visibleTask(ctx, lists)));
  return t ?? null;
}

const COLS = {
  id: todoTasks.id, title: todoTasks.title, notes: todoTasks.notes, dueDate: todoTasks.dueDate, dueTime: todoTasks.dueTime, priority: todoTasks.priority, recurrence: todoTasks.recurrence,
  listId: todoTasks.listId, parentId: todoTasks.parentId, assignee: todoTasks.assigneeMemberId, createdBy: todoTasks.createdByMemberId, completedAt: todoTasks.completedAt, position: todoTasks.position,
};

/** Tâches d'une vue (sous-tâches comprises, pour le détail), les terminées des 7 derniers jours en option. */
export async function tasksFor(ctx: AppContext, view: TodoView, today: string, withDone: boolean) {
  const lists = (await visibleLists(ctx)).map((l) => l.id);
  const me = ctx.member.id;
  const base = visibleTask(ctx, lists);
  const done = withDone ? or(isNull(todoTasks.completedAt), sql`${todoTasks.completedAt} > now() - interval '7 days'`) : isNull(todoTasks.completedAt);
  const mine = or(eq(todoTasks.assigneeMemberId, me), and(isNull(todoTasks.assigneeMemberId), eq(todoTasks.createdByMemberId, me)));
  const scope =
    view.kind === "inbox" ? isNull(todoTasks.listId)
    : view.kind === "today" ? and(mine, isNotNull(todoTasks.dueDate), lte(todoTasks.dueDate, today))
    : view.kind === "upcoming" ? and(mine, isNotNull(todoTasks.dueDate), sql`${todoTasks.dueDate} <= ${today}::date + 30`)
    : view.kind === "assigned" ? eq(todoTasks.assigneeMemberId, me)
    : eq(todoTasks.listId, view.id);
  const top = await db.select(COLS).from(todoTasks).where(and(base, scope, done, isNull(todoTasks.parentId))).orderBy(asc(todoTasks.completedAt), sql`${todoTasks.dueDate} asc nulls last`, asc(todoTasks.priority), asc(todoTasks.position), asc(todoTasks.createdAt)).limit(500);
  const subs = top.length ? await db.select(COLS).from(todoTasks).where(and(eq(todoTasks.businessId, ctx.business.id), inArray(todoTasks.parentId, top.map((t) => t.id)))).orderBy(asc(todoTasks.completedAt), asc(todoTasks.position), asc(todoTasks.createdAt)) : [];
  return { top, subs };
}

export async function teamOf(businessId: string) {
  return db.select({ id: members.id, name: members.displayName }).from(members).where(and(eq(members.businessId, businessId), eq(members.status, "active"))).orderBy(asc(members.displayName));
}

/** Nombre de tâches du jour (badge du menu). */
export async function todayCount(ctx: AppContext, today: string) {
  const { top } = await tasksFor(ctx, { kind: "today" }, today, false);
  return top.length;
}

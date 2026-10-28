"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { members, todoListMembers, todoLists, todoTasks, users } from "@/db/schema";
import { todayIn } from "@/lib/planning";
import { LIST_COLORS, nextDue, parseQuickAdd, type Recurrence } from "@/lib/todos";
import { requireContext, type AppContext } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { canSeeTask, teamOf, visibleLists } from "@/server/todos";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Lecture seule pendant la supervision." };
const RECUR = ["daily", "weekdays", "weekly", "monthly", "yearly"] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const refresh = () => revalidatePath("/app/taches", "layout");
const manager = (ctx: AppContext) => ctx.member.isOwner || ctx.can("settings.manage");

async function activeMember(businessId: string, id: string | null | undefined) {
  if (!id) return null;
  if (!z.uuid().safeParse(id).success) return undefined;
  const [m] = await db.select({ id: members.id }).from(members).where(and(eq(members.id, id), eq(members.businessId, businessId), eq(members.status, "active")));
  return m ? m.id : undefined;
}

/** Prévient la personne à qui l'on confie une tâche (pas soi-même). */
async function notifyAssignee(ctx: AppContext, assigneeId: string | null, title: string, due: string | null) {
  if (!assigneeId || assigneeId === ctx.member.id) return;
  const [u] = await db.select({ email: users.email }).from(members).innerJoin(users, eq(users.id, members.userId)).where(eq(members.id, assigneeId));
  if (!u) return;
  const url = `${(process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "")}/app/taches/aujourdhui`;
  await sendEmail({ to: u.email, ...emails.todoAssigned({ from: ctx.user.name, title, due, url, business: ctx.business.name }), template: "todo_assigned", businessId: ctx.business.id }).catch(() => {});
}

const addSchema = z.object({ text: z.string().trim().min(1).max(500), listId: z.string().max(40).nullable().optional(), parentId: z.string().max(40).nullable().optional(), dueDate: isoDate.nullable().optional() });

/** Ajout rapide : « Appeler Marc demain 14h p1 #Chantier @Lucas ». */
export async function addTask(input: z.input<typeof addSchema>): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  const v = addSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Écrivez la tâche." };
  const lists = await visibleLists(ctx);
  const team = await teamOf(ctx.business.id);
  const today = todayIn(ctx.business.timezone);
  const q = parseQuickAdd(v.data.text, today, lists, team);
  let listId = q.listId ?? v.data.listId ?? null;
  let parentId: string | null = null;
  if (v.data.parentId) {
    const parent = await canSeeTask(ctx, v.data.parentId);
    if (!parent || parent.parentId) return { ok: false, error: "Tâche introuvable." };
    parentId = parent.id;
    listId = parent.listId;
  }
  if (listId && !lists.some((l) => l.id === listId)) return { ok: false, error: "Liste introuvable." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(todoTasks).where(and(eq(todoTasks.businessId, ctx.business.id), isNull(todoTasks.completedAt)));
  if (n >= 20000) return { ok: false, error: "Trop de tâches ouvertes : terminez-en quelques-unes." };
  const [t] = await db
    .insert(todoTasks)
    .values({ businessId: ctx.business.id, listId, parentId, title: q.title.slice(0, 300), dueDate: q.dueDate ?? v.data.dueDate ?? null, dueTime: q.dueTime, priority: q.priority, recurrence: q.recurrence, assigneeMemberId: q.assigneeId, createdByMemberId: ctx.member.id })
    .returning({ id: todoTasks.id });
  await notifyAssignee(ctx, q.assigneeId, q.title, q.dueDate);
  refresh();
  return { ok: true, id: t!.id };
}

const updSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  notes: z.string().max(5000).optional(),
  dueDate: isoDate.nullable().optional(),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  recurrence: z.enum(RECUR).nullable().optional(),
  assigneeId: z.string().max(40).nullable().optional(),
  listId: z.string().max(40).nullable().optional(),
});

export async function updateTask(id: string, input: z.input<typeof updSchema>): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  const v = updSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Vérifiez les champs." };
  const t = await canSeeTask(ctx, id);
  if (!t) return { ok: false, error: "Tâche introuvable." };
  const d = v.data;
  const set: Partial<typeof todoTasks.$inferInsert> = { updatedAt: new Date() };
  if (d.title !== undefined) set.title = d.title;
  if (d.notes !== undefined) set.notes = d.notes.trim() || null;
  if (d.dueDate !== undefined) set.dueDate = d.dueDate;
  if (d.dueTime !== undefined) set.dueTime = d.dueTime;
  if (d.priority !== undefined) set.priority = d.priority;
  if (d.recurrence !== undefined) set.recurrence = d.recurrence;
  if (d.assigneeId !== undefined) {
    const a = await activeMember(ctx.business.id, d.assigneeId);
    if (a === undefined) return { ok: false, error: "Personne introuvable." };
    set.assigneeMemberId = a;
  }
  if (d.listId !== undefined && !t.parentId) {
    if (d.listId && !(await visibleLists(ctx)).some((l) => l.id === d.listId)) return { ok: false, error: "Liste introuvable." };
    set.listId = d.listId;
  }
  await db.transaction(async (tx) => {
    await tx.update(todoTasks).set(set).where(eq(todoTasks.id, t.id));
    // Les sous-tâches suivent leur tâche dans la liste choisie.
    if (set.listId !== undefined) await tx.update(todoTasks).set({ listId: set.listId }).where(eq(todoTasks.parentId, t.id));
  });
  if (set.assigneeMemberId && set.assigneeMemberId !== t.assigneeMemberId) await notifyAssignee(ctx, set.assigneeMemberId, set.title ?? t.title, set.dueDate ?? t.dueDate);
  refresh();
  return { ok: true };
}

/** Cocher / décocher. Une tâche récurrente cochée repart à sa prochaine échéance. */
export async function toggleTask(id: string): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  const t = await canSeeTask(ctx, id);
  if (!t) return { ok: false, error: "Tâche introuvable." };
  if (t.completedAt) {
    await db.update(todoTasks).set({ completedAt: null, completedByMemberId: null, updatedAt: new Date() }).where(eq(todoTasks.id, t.id));
  } else if (t.recurrence && t.dueDate && !t.parentId) {
    const next = nextDue(t.dueDate, t.recurrence as Recurrence, todayIn(ctx.business.timezone));
    await db.update(todoTasks).set({ dueDate: next, updatedAt: new Date() }).where(and(eq(todoTasks.id, t.id), eq(todoTasks.dueDate, t.dueDate)));
    refresh();
    return { ok: true, message: `Fait ! Prochaine fois : ${new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${next}T12:00:00Z`))}.` };
  } else {
    await db.update(todoTasks).set({ completedAt: new Date(), completedByMemberId: ctx.member.id, updatedAt: new Date() }).where(and(eq(todoTasks.id, t.id), isNull(todoTasks.completedAt)));
  }
  refresh();
  return { ok: true };
}

/** Supprimer : son auteur, le créateur de la liste, ou le responsable. */
export async function deleteTask(id: string): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  const t = await canSeeTask(ctx, id);
  if (!t) return { ok: false, error: "Tâche introuvable." };
  let allowed = manager(ctx) || t.createdByMemberId === ctx.member.id;
  if (!allowed && t.listId) {
    const [l] = await db.select({ by: todoLists.createdByMemberId }).from(todoLists).where(eq(todoLists.id, t.listId));
    allowed = l?.by === ctx.member.id;
  }
  if (!allowed) return { ok: false, error: "Seul l'auteur de la tâche (ou le responsable) peut la supprimer. Vous pouvez la cocher." };
  await db.delete(todoTasks).where(and(eq(todoTasks.businessId, ctx.business.id), sql`(${todoTasks.id} = ${t.id} or ${todoTasks.parentId} = ${t.id})`));
  refresh();
  return { ok: true, message: "Tâche supprimée." };
}

const listSchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(1, "Donnez un nom à la liste.").max(60),
  color: z.enum(LIST_COLORS),
  visibility: z.enum(["team", "private", "members"]),
  memberIds: z.array(z.string().max(40)).max(200).default([]),
});

export async function saveList(input: z.input<typeof listSchema>): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  const v = listSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez la liste." };
  const d = v.data;
  const ids = d.visibility === "members" && d.memberIds.length ? (await db.select({ id: members.id }).from(members).where(and(eq(members.businessId, ctx.business.id), eq(members.status, "active"), inArray(members.id, d.memberIds.filter((x) => z.uuid().safeParse(x).success))))).map((m) => m.id) : [];
  if (d.id) {
    if (!z.uuid().safeParse(d.id).success) return { ok: false, error: "Liste introuvable." };
    const [l] = await db.select().from(todoLists).where(and(eq(todoLists.id, d.id), eq(todoLists.businessId, ctx.business.id), isNull(todoLists.archivedAt)));
    if (!l) return { ok: false, error: "Liste introuvable." };
    if (!(manager(ctx) || l.createdByMemberId === ctx.member.id)) return { ok: false, error: "Seul le créateur de la liste (ou le responsable) la modifie." };
    await db.transaction(async (tx) => {
      await tx.update(todoLists).set({ name: d.name, color: d.color, visibility: d.visibility, updatedAt: new Date() }).where(eq(todoLists.id, l.id));
      await tx.delete(todoListMembers).where(eq(todoListMembers.listId, l.id));
      if (ids.length) await tx.insert(todoListMembers).values(ids.map((memberId) => ({ listId: l.id, memberId })));
    });
    refresh();
    return { ok: true, id: l.id, message: "Liste enregistrée." };
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(todoLists).where(and(eq(todoLists.businessId, ctx.business.id), isNull(todoLists.archivedAt)));
  if (n >= 300) return { ok: false, error: "300 listes maximum : archivez-en quelques-unes." };
  const id = await db.transaction(async (tx) => {
    const [l] = await tx.insert(todoLists).values({ businessId: ctx.business.id, name: d.name, color: d.color, visibility: d.visibility, createdByMemberId: ctx.member.id, position: n }).returning({ id: todoLists.id });
    if (ids.length) await tx.insert(todoListMembers).values(ids.map((memberId) => ({ listId: l!.id, memberId })));
    return l!.id;
  });
  refresh();
  return { ok: true, id, message: "Liste créée." };
}

export async function archiveList(id: string): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Liste introuvable." };
  const [l] = await db.select().from(todoLists).where(and(eq(todoLists.id, id), eq(todoLists.businessId, ctx.business.id)));
  if (!l) return { ok: false, error: "Liste introuvable." };
  if (!(manager(ctx) || l.createdByMemberId === ctx.member.id)) return { ok: false, error: "Seul le créateur de la liste (ou le responsable) peut l'archiver." };
  await db.update(todoLists).set({ archivedAt: new Date() }).where(eq(todoLists.id, l.id));
  refresh();
  return { ok: true, message: "Liste archivée." };
}

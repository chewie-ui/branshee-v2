"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers, members, projectTasks, projects, timeEntries } from "@/db/schema";
import { newLine } from "@/lib/invoicing";
import { PROJECT_COLORS, PROJECT_STATUS, fmtMinutes, isTaskStatus } from "@/lib/projects";
import { todayIn } from "@/lib/planning";
import { requireContext, type AppContext } from "@/server/context";
import { getSellerSettings } from "@/server/invoicing";
import { projectRights, unbilled } from "@/server/projects";
import { saveDocument } from "@/server/actions/invoicing";

type Result = { ok: true; message?: string; id?: string; url?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const NOT_FOUND = { ok: false as const, error: "Introuvable." };
const refresh = () => revalidatePath("/app/projets", "layout");
const day = z.union([z.literal(""), z.iso.date()]).transform((v) => v || null);
const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const minutes = z.union([z.literal(""), z.number().int().min(0).max(100_000)]).transform((v) => (v === "" ? null : v));

async function member(): Promise<{ ctx: AppContext; error: null } | { ctx: AppContext; error: { ok: false; error: string } }> {
  const ctx = await requireContext();
  return ctx.impersonating ? { ctx, error: SUPERVISION } : { ctx, error: null };
}
async function manager() {
  const r = await member();
  if (!r.error && !projectRights(r.ctx).manage) return { ctx: r.ctx, error: { ok: false as const, error: "Seul le responsable peut modifier les projets." } };
  return r;
}
async function ownProject(businessId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [p] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.businessId, businessId)));
  return p ?? null;
}
async function ownMember(businessId: string, id: string | null) {
  if (!id) return true;
  const [m] = await db.select({ id: members.id }).from(members).where(and(eq(members.id, id), eq(members.businessId, businessId)));
  return !!m;
}

/* ───────── Projets ───────── */

const projectSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Donnez un nom au projet.").max(120),
  description: opt(1000),
  customerId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
  color: z.enum(Object.keys(PROJECT_COLORS) as [string, ...string[]]).default("indigo"),
  rate: z.union([z.number(), z.string()]).transform((v) => Math.round(Number(String(v).replace(",", ".") || 0) * 100)).pipe(z.number().int().min(0, "Tarif invalide.").max(10_000_00, "Tarif invalide.")),
  budgetHours: z.union([z.number(), z.string()]).transform((v) => (String(v).trim() === "" ? null : Math.round(Number(String(v).replace(",", ".")) * 60))).pipe(z.number().int().min(0, "Budget invalide.").max(1_000_000).nullable()),
  deadline: day,
});

export async function saveProject(input: z.input<typeof projectSchema>): Promise<Result> {
  const { ctx, error } = await manager();
  if (error) return error;
  const v = projectSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  if (d.customerId) {
    const [c] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, d.customerId), eq(customers.businessId, ctx.business.id)));
    if (!c) return { ok: false, error: "Client introuvable." };
  }
  const values = { name: d.name, description: d.description, customerId: d.customerId, color: d.color, hourlyRateCents: d.rate, budgetMinutes: d.budgetHours, deadline: d.deadline, updatedAt: new Date() };
  if (d.id) {
    const done = await db.update(projects).set(values).where(and(eq(projects.id, d.id), eq(projects.businessId, ctx.business.id))).returning({ id: projects.id });
    if (!done.length) return NOT_FOUND;
    refresh();
    return { ok: true, message: "Projet enregistré.", id: d.id };
  }
  const [row] = await db.insert(projects).values({ ...values, businessId: ctx.business.id }).returning({ id: projects.id });
  refresh();
  return { ok: true, message: "Projet créé.", id: row!.id, url: `/app/projets/${row!.id}` };
}

export async function setProjectStatus(id: string, status: string): Promise<Result> {
  const { ctx, error } = await manager();
  if (error) return error;
  if (!z.uuid().safeParse(id).success || !(status in PROJECT_STATUS)) return NOT_FOUND;
  const done = await db.update(projects).set({ status, updatedAt: new Date() }).where(and(eq(projects.id, id), eq(projects.businessId, ctx.business.id))).returning({ id: projects.id });
  if (!done.length) return NOT_FOUND;
  refresh();
  return { ok: true, message: status === "done" ? "Projet terminé. Bravo !" : status === "archived" ? "Projet archivé." : "Projet réouvert." };
}

export async function deleteProject(id: string): Promise<Result> {
  const { ctx, error } = await manager();
  if (error) return error;
  if (!(await ownProject(ctx.business.id, id))) return NOT_FOUND;
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.businessId, ctx.business.id)));
  refresh();
  return { ok: true, message: "Projet supprimé.", url: "/app/projets" };
}

/* ───────── Tâches ───────── */

const taskSchema = z.object({
  id: z.uuid().optional(),
  projectId: z.uuid(),
  title: z.string().trim().min(1, "Donnez un titre à la tâche.").max(200),
  description: opt(4000),
  status: z.string().refine(isTaskStatus).default("todo"),
  assigneeMemberId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
  dueDate: day,
  estimateMinutes: minutes,
});

export async function saveTask(input: z.input<typeof taskSchema>): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  const v = taskSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  if (!(await ownProject(ctx.business.id, d.projectId))) return NOT_FOUND;
  if (!(await ownMember(ctx.business.id, d.assigneeMemberId))) return { ok: false, error: "Personne introuvable." };
  const values = { title: d.title, description: d.description, assigneeMemberId: d.assigneeMemberId, dueDate: d.dueDate, estimateMinutes: d.estimateMinutes, updatedAt: new Date() };
  if (d.id) {
    const done = await db.update(projectTasks).set(values).where(and(eq(projectTasks.id, d.id), eq(projectTasks.projectId, d.projectId), eq(projectTasks.businessId, ctx.business.id))).returning({ id: projectTasks.id });
    if (!done.length) return NOT_FOUND;
  } else {
    const [{ n }] = await db.select({ n: sql<number>`coalesce(max(${projectTasks.position}), -1)::int + 1` }).from(projectTasks).where(eq(projectTasks.projectId, d.projectId));
    await db.insert(projectTasks).values({ ...values, businessId: ctx.business.id, projectId: d.projectId, status: d.status, position: n, completedAt: d.status === "done" ? new Date() : null });
  }
  refresh();
  return { ok: true, message: d.id ? "Tâche enregistrée." : "Tâche ajoutée." };
}

export async function moveTask(id: string, status: string): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  if (!z.uuid().safeParse(id).success || !isTaskStatus(status)) return NOT_FOUND;
  const done = await db.update(projectTasks).set({ status, completedAt: status === "done" ? new Date() : null, updatedAt: new Date() }).where(and(eq(projectTasks.id, id), eq(projectTasks.businessId, ctx.business.id))).returning({ id: projectTasks.id });
  if (!done.length) return NOT_FOUND;
  refresh();
  return { ok: true };
}

export async function deleteTask(id: string): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  const [t] = await db.select({ assignee: projectTasks.assigneeMemberId }).from(projectTasks).where(and(eq(projectTasks.id, id), eq(projectTasks.businessId, ctx.business.id)));
  if (!t) return NOT_FOUND;
  if (!projectRights(ctx).manage && t.assignee && t.assignee !== ctx.member.id) return { ok: false, error: "Seul le responsable ou la personne assignée peut supprimer cette tâche." };
  await db.delete(projectTasks).where(and(eq(projectTasks.id, id), eq(projectTasks.businessId, ctx.business.id)));
  refresh();
  return { ok: true, message: "Tâche supprimée." };
}

/* ───────── Temps ───────── */

const timeSchema = z.object({
  projectId: z.uuid(),
  taskId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
  memberId: z.union([z.literal(""), z.uuid()]).optional(),
  day: z.iso.date({ message: "Date invalide." }),
  minutes: z.number().int().min(1, "Indiquez une durée (ex. : 1h30).").max(24 * 60, "24 heures maximum par saisie."),
  note: opt(300),
  billable: z.boolean().default(true),
});

/** Noter du temps : pour soi, ou pour un membre de l'équipe si on est responsable. */
export async function logTime(input: z.input<typeof timeSchema>): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  const v = timeSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  if (!(await ownProject(ctx.business.id, d.projectId))) return NOT_FOUND;
  if (d.taskId) {
    const [t] = await db.select({ id: projectTasks.id }).from(projectTasks).where(and(eq(projectTasks.id, d.taskId), eq(projectTasks.projectId, d.projectId)));
    if (!t) return { ok: false, error: "Tâche introuvable." };
  }
  const who = d.memberId && projectRights(ctx).manage ? d.memberId : ctx.member.id;
  if (!(await ownMember(ctx.business.id, who))) return { ok: false, error: "Personne introuvable." };
  const today = todayIn(ctx.business.timezone);
  if (d.day > today) return { ok: false, error: "On ne note pas du temps dans le futur." };
  await db.insert(timeEntries).values({ businessId: ctx.business.id, projectId: d.projectId, taskId: d.taskId, memberId: who, day: d.day, minutes: d.minutes, note: d.note, billable: d.billable });
  refresh();
  return { ok: true, message: `${fmtMinutes(d.minutes)} noté${d.minutes >= 120 ? "es" : ""}.` };
}

export async function deleteTime(id: string): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  const [e] = await db.select({ memberId: timeEntries.memberId, billed: sql<boolean>`not (${unbilled}) and ${timeEntries.billable}` }).from(timeEntries).where(and(eq(timeEntries.id, id), eq(timeEntries.businessId, ctx.business.id)));
  if (!e) return NOT_FOUND;
  if (e.billed) return { ok: false, error: "Ce temps est déjà facturé : supprimez d'abord le brouillon de facture." };
  if (e.memberId !== ctx.member.id && !projectRights(ctx).manage) return { ok: false, error: "Vous ne pouvez supprimer que votre temps." };
  await db.delete(timeEntries).where(and(eq(timeEntries.id, id), eq(timeEntries.businessId, ctx.business.id)));
  refresh();
  return { ok: true, message: "Temps supprimé." };
}

/**
 * Facturer le temps : un brouillon de facture au client du projet, une ligne par tâche (heures × tarif).
 * Le temps repris est marqué ; si le brouillon est supprimé ou annulé, il redevient « à facturer ».
 */
export async function invoiceProjectTime(projectId: string): Promise<Result> {
  const { ctx, error } = await manager();
  if (error) return error;
  if (!projectRights(ctx).invoice) return { ok: false, error: "Vous n'avez pas le droit de créer des factures." };
  const p = await ownProject(ctx.business.id, projectId);
  if (!p) return NOT_FOUND;
  if (!p.customerId) return { ok: false, error: "Choisissez d'abord le client du projet (Modifier le projet)." };
  if (!p.hourlyRateCents) return { ok: false, error: "Indiquez d'abord le tarif horaire du projet (Modifier le projet)." };
  // Verrou par projet : deux clics (ou deux onglets) ne facturent pas deux fois le même temps.
  return db.transaction(async (tx) => {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`invoice-time:${p.id}`}))`);
  const rows = await tx
    .select({ id: timeEntries.id, minutes: timeEntries.minutes, taskTitle: projectTasks.title, day: timeEntries.day })
    .from(timeEntries)
    .leftJoin(projectTasks, eq(projectTasks.id, timeEntries.taskId))
    .where(and(eq(timeEntries.projectId, p.id), eq(timeEntries.businessId, ctx.business.id), unbilled));
  if (!rows.length) return { ok: false as const, error: "Aucun temps à facturer sur ce projet." };
  const groups = new Map<string, number>();
  for (const r of rows) groups.set(r.taskTitle ?? "Autres travaux", (groups.get(r.taskTitle ?? "Autres travaux") ?? 0) + r.minutes);
  const seller = await getSellerSettings(ctx.business.id);
  const days = rows.map((r) => r.day).sort();
  const period = days[0] === days.at(-1) ? days[0] : `${days[0]} → ${days.at(-1)}`;
  const today = todayIn(ctx.business.timezone);
  const lines = [...groups].map(([task, mins]) => ({ ...newLine(), desc: `${p.name} — ${task}`, qty: Math.round((mins / 60) * 100) / 100, unit: "heure", price: p.hourlyRateCents / 100, vat: seller.vatRegime === "franchise" ? 0 : 21 }));
  const r = await saveDocument({ docType: "invoice", customerId: p.customerId, issueDate: today, serviceDate: days.at(-1) ?? today, notes: `Temps passé sur « ${p.name} » (${period}).`, lines });
  if (!r.ok || !r.id) return { ok: false as const, error: r.ok ? "Facture impossible." : r.error };
  await tx.update(timeEntries).set({ invoiceId: r.id }).where(and(eq(timeEntries.businessId, ctx.business.id), inArray(timeEntries.id, rows.map((x) => x.id))));
  refresh();
  return { ok: true as const, message: "Brouillon de facture créé.", url: `/app/factures/${r.id}` };
  });
}

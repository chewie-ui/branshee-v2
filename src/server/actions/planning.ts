"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, members, shifts } from "@/db/schema";
import { addDays, isDay, isTime, mondayOf, weekRangeLabel } from "@/lib/planning";
import { requireContext, type AppContext } from "@/server/context";
import { planningRights } from "@/server/planning";

type Result = { ok: true; message?: string; token?: string } | { ok: false; error: string };
const log = (ctx: AppContext, action: string, description: string) => db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action, description });

const shiftSchema = z.object({
  id: z.uuid().optional(),
  memberIds: z.array(z.uuid()).min(1, "Choisissez au moins une personne.").max(200),
  days: z.array(z.string().refine(isDay)).min(1, "Choisissez au moins un jour.").max(31),
  start: z.string().refine(isTime, "Heure de début invalide."),
  end: z.string().refine(isTime, "Heure de fin invalide."),
  breakMinutes: z.number().int().min(0).max(600),
  label: z.string().trim().max(60),
  note: z.string().trim().max(300),
});

async function guard() {
  const ctx = await requireContext();
  if (ctx.impersonating) return { ctx, error: "Action réservée au titulaire du compte (session de supervision)." };
  if (!planningRights(ctx).manage) return { ctx, error: "Seul le responsable peut modifier le planning." };
  return { ctx, error: null };
}

async function ownMembers(ctx: AppContext, ids: string[]) {
  const rows = await db.select({ id: members.id }).from(members).where(and(eq(members.businessId, ctx.business.id), inArray(members.id, ids)));
  return rows.length === new Set(ids).size;
}

/**
 * Ajouter une plage (à plusieurs personnes et plusieurs jours d'un coup), ou modifier une plage existante.
 * Début = fin interdit ; fin avant le début = jusqu'au lendemain.
 */
export async function saveShift(input: z.input<typeof shiftSchema>): Promise<Result> {
  const { ctx, error } = await guard();
  if (error) return { ok: false, error };
  const v = shiftSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  if (d.start === d.end) return { ok: false, error: "L'heure de fin doit être différente de l'heure de début." };
  if (!(await ownMembers(ctx, d.memberIds))) return { ok: false, error: "Membre introuvable." };
  const values = { startTime: d.start, endTime: d.end, breakMinutes: d.breakMinutes, label: d.label || null, note: d.note || null };
  if (d.id) {
    const updated = await db.update(shifts).set({ ...values, memberId: d.memberIds[0]!, day: d.days[0]!, updatedAt: new Date() }).where(and(eq(shifts.id, d.id), eq(shifts.businessId, ctx.business.id))).returning({ id: shifts.id });
    if (!updated.length) return { ok: false, error: "Horaire introuvable." };
    revalidatePath("/app/planning");
    return { ok: true, message: "Horaire modifié." };
  }
  const rows = d.memberIds.flatMap((memberId) => d.days.map((day) => ({ ...values, businessId: ctx.business.id, memberId, day, createdById: ctx.user.id })));
  await db.insert(shifts).values(rows);
  await log(ctx, "planning.add", `Planning : ${rows.length} horaire${rows.length > 1 ? "s" : ""} ajouté${rows.length > 1 ? "s" : ""}`);
  revalidatePath("/app/planning");
  return { ok: true, message: rows.length > 1 ? `${rows.length} horaires ajoutés.` : "Horaire ajouté." };
}

export async function deleteShift(id: string): Promise<Result> {
  const { ctx, error } = await guard();
  if (error) return { ok: false, error };
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Horaire introuvable." };
  const gone = await db.delete(shifts).where(and(eq(shifts.id, parsed.data), eq(shifts.businessId, ctx.business.id))).returning({ id: shifts.id });
  if (!gone.length) return { ok: false, error: "Horaire introuvable." };
  revalidatePath("/app/planning");
  return { ok: true, message: "Horaire supprimé." };
}

/** Recopier la semaine précédente (les plages déjà présentes à l'identique ne sont pas doublées). */
export async function copyPreviousWeek(monday: string): Promise<Result> {
  const { ctx, error } = await guard();
  if (error) return { ok: false, error };
  if (!isDay(monday) || mondayOf(monday) !== monday) return { ok: false, error: "Semaine invalide." };
  const prev = addDays(monday, -7);
  const [source, existing] = await Promise.all([
    db.select().from(shifts).where(and(eq(shifts.businessId, ctx.business.id), gte(shifts.day, prev), lte(shifts.day, addDays(prev, 6)))),
    db.select().from(shifts).where(and(eq(shifts.businessId, ctx.business.id), gte(shifts.day, monday), lte(shifts.day, addDays(monday, 6)))),
  ]);
  if (!source.length) return { ok: false, error: "La semaine précédente est vide : rien à recopier." };
  const key = (s: { memberId: string; day: string; startTime: string; endTime: string }) => `${s.memberId}|${s.day}|${s.startTime}|${s.endTime}`;
  const have = new Set(existing.map(key));
  const rows = source
    .map((s) => ({ businessId: s.businessId, memberId: s.memberId, day: addDays(s.day, 7), startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes, label: s.label, note: s.note, createdById: ctx.user.id }))
    .filter((r) => !have.has(key(r)));
  if (!rows.length) return { ok: true, message: "Cette semaine contient déjà les mêmes horaires." };
  await db.insert(shifts).values(rows);
  await log(ctx, "planning.copy", `Planning : semaine du ${weekRangeLabel(prev)} recopiée`);
  revalidatePath("/app/planning");
  return { ok: true, message: `${rows.length} horaire${rows.length > 1 ? "s" : ""} recopié${rows.length > 1 ? "s" : ""}.` };
}

/** Vider la semaine affichée. */
export async function clearWeek(monday: string): Promise<Result> {
  const { ctx, error } = await guard();
  if (error) return { ok: false, error };
  if (!isDay(monday) || mondayOf(monday) !== monday) return { ok: false, error: "Semaine invalide." };
  const gone = await db.delete(shifts).where(and(eq(shifts.businessId, ctx.business.id), gte(shifts.day, monday), lte(shifts.day, addDays(monday, 6)))).returning({ id: shifts.id });
  await log(ctx, "planning.clear", `Planning : semaine du ${weekRangeLabel(monday)} vidée`);
  revalidatePath("/app/planning");
  return { ok: true, message: gone.length ? `${gone.length} horaire${gone.length > 1 ? "s" : ""} supprimé${gone.length > 1 ? "s" : ""}.` : "La semaine était déjà vide." };
}

/** Lien d'abonnement agenda personnel (Google Agenda, Apple, Outlook) : créé au premier besoin. */
export async function planningFeedToken(): Promise<Result> {
  const ctx = await requireContext();
  const [m] = await db.select({ t: members.calendarFeedToken }).from(members).where(eq(members.id, ctx.member.id));
  if (m?.t) return { ok: true, token: m.t };
  const token = randomBytes(24).toString("hex");
  await db.update(members).set({ calendarFeedToken: token }).where(eq(members.id, ctx.member.id));
  return { ok: true, token };
}

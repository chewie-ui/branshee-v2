"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
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
  const ctx = await requireContext(undefined, { app: "horaires" });
  if (ctx.impersonating) return { ctx, error: "Action réservée au titulaire du compte (session de supervision)." };
  if (!planningRights(ctx).manage) return { ctx, error: "Seul le responsable peut modifier le planning." };
  return { ctx, error: null };
}

async function ownMembers(ctx: AppContext, ids: string[]) {
  const rows = await db.select({ id: members.id }).from(members).where(and(eq(members.businessId, ctx.business.id), inArray(members.id, ids), eq(members.isActive, true), inArray(members.status, ["active", "invited"])));
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
  if (d.id && (d.memberIds.length > 1 || d.days.length > 1)) return { ok: false, error: "Un horaire existant ne concerne qu'une personne et un jour." };
  if (!(await ownMembers(ctx, d.memberIds))) return { ok: false, error: "Membre introuvable." };
  // Deux horaires qui se chevauchent pour la même personne le même jour : heures comptées deux fois (Planning, Paie).
  const span = (a: string, b: string) => { const x = Number(a.slice(0, 2)) * 60 + Number(a.slice(3, 5)); let y = Number(b.slice(0, 2)) * 60 + Number(b.slice(3, 5)); if (y <= x) y += 1440; return [x, y] as const; };
  const [ns, ne] = span(d.start, d.end);
  const existing = await db
    .select({ id: shifts.id, memberId: shifts.memberId, day: shifts.day, start: shifts.startTime, end: shifts.endTime, name: members.displayName })
    .from(shifts)
    .innerJoin(members, eq(members.id, shifts.memberId))
    .where(and(eq(shifts.businessId, ctx.business.id), inArray(shifts.memberId, d.memberIds), inArray(shifts.day, d.days)));
  const clash = existing.find((x) => x.id !== d.id && (() => { const [es, ee] = span(x.start, x.end); return ns < ee && es < ne; })());
  if (clash) return { ok: false, error: `${clash.name} a déjà un horaire qui chevauche celui-ci le ${new Date(`${clash.day}T12:00:00`).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })} (${clash.start.slice(0, 5)}–${clash.end.slice(0, 5)}).` };
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
  // Verrou par établissement et par semaine : deux clics ne recopient pas deux fois.
  const res = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`planning:${ctx.business.id}:${monday}`}))`);
    const [source, existing] = await Promise.all([
      tx.select().from(shifts).where(and(eq(shifts.businessId, ctx.business.id), gte(shifts.day, prev), lte(shifts.day, addDays(prev, 6)))),
      tx.select().from(shifts).where(and(eq(shifts.businessId, ctx.business.id), gte(shifts.day, monday), lte(shifts.day, addDays(monday, 6)))),
    ]);
    if (!source.length) return { empty: true as const };
    const key = (s: { memberId: string; day: string; startTime: string; endTime: string }) => `${s.memberId}|${s.day}|${s.startTime}|${s.endTime}`;
    const have = new Set(existing.map(key));
    const rows = source
      .map((s) => ({ businessId: s.businessId, memberId: s.memberId, day: addDays(s.day, 7), startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes, label: s.label, note: s.note, createdById: ctx.user.id }))
      .filter((r) => !have.has(key(r)));
    if (rows.length) await tx.insert(shifts).values(rows);
    return { count: rows.length };
  });
  if ("empty" in res) return { ok: false, error: "La semaine précédente est vide : rien à recopier." };
  if (!res.count) return { ok: true, message: "Cette semaine contient déjà les mêmes horaires." };
  const rows = { length: res.count };
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
  const ctx = await requireContext(undefined, { app: "horaires" });
  if (ctx.impersonating) return { ok: false, error: "Le lien d'agenda n'est pas visible pendant une session de supervision." };
  const [m] = await db.select({ t: members.calendarFeedToken }).from(members).where(eq(members.id, ctx.member.id));
  if (m?.t) return { ok: true, token: m.t };
  const token = randomBytes(24).toString("hex");
  await db.update(members).set({ calendarFeedToken: token }).where(eq(members.id, ctx.member.id));
  return { ok: true, token };
}

/** Nouveau lien d'agenda : l'ancien cesse de fonctionner (lien partagé par erreur, téléphone perdu…). */
export async function regenerateFeedToken(): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "horaires" });
  if (ctx.impersonating) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const token = randomBytes(24).toString("hex");
  await db.update(members).set({ calendarFeedToken: token }).where(eq(members.id, ctx.member.id));
  return { ok: true, token, message: "Nouveau lien créé : l'ancien ne fonctionne plus." };
}

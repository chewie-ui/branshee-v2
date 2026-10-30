"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, bookingSettings, members, scheduleExceptions, weeklyHours } from "@/db/schema";
import type { PermissionKey } from "@/lib/permissions";
import { requireContext, type AppContext } from "@/server/context";
import { range, weekError, weekSchema } from "@/lib/week-schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Vérifie le droit de modifier les horaires (ou congés) d'un membre donné, ou de l'établissement si `memberId` est null. */
async function assertCanEdit(ctx: AppContext, memberId: string | null, kind: "schedule" | "timeOff") {
  if (memberId === null) {
    if (!ctx.can("availability.manageShared")) throw new Error("forbidden");
    return null;
  }
  const [m] = await db.select().from(members).where(and(eq(members.id, memberId), eq(members.businessId, ctx.business.id)));
  if (!m) throw new Error("forbidden");
  const own = m.id === ctx.member.id;
  if (kind === "schedule") {
    const key: PermissionKey = own ? "availability.manageOwnSchedule" : "availability.manageOthersSchedule";
    if (!ctx.can(key)) throw new Error("forbidden");
  } else {
    // Le réglage individuel « peut gérer ses congés » prime sur le grade.
    const allowed = own ? (m.canManageOwnTimeOff ?? ctx.can("availability.manageOwnTimeOff")) || ctx.member.isOwner : ctx.can("availability.manageOthersTimeOff");
    if (!allowed) throw new Error("forbidden");
  }
  return m;
}

const FORBIDDEN: ActionResult = { ok: false, error: "Vous n'avez pas le droit de modifier ces horaires." };

export async function saveWeeklyHours(memberId: string | null, week: Record<string, unknown>): Promise<ActionResult> {
  const ctx = await requireContext(undefined, { app: "rdv" });
  try {
    await assertCanEdit(ctx, memberId, "schedule");
  } catch {
    return FORBIDDEN;
  }

  const parsed = weekSchema.safeParse(week);
  if (!parsed.success) return { ok: false, error: weekError(parsed.error.issues) };

  const rows = Object.entries(parsed.data).flatMap(([weekday, ranges]) =>
    ranges.map((r) => ({ businessId: ctx.business.id, memberId, weekday: Number(weekday), startTime: r.start, endTime: r.end })),
  );

  await db.transaction(async (tx) => {
    await tx.delete(weeklyHours).where(and(eq(weeklyHours.businessId, ctx.business.id), memberId === null ? isNull(weeklyHours.memberId) : eq(weeklyHours.memberId, memberId)));
    if (rows.length) await tx.insert(weeklyHours).values(rows);
    await tx.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "schedule.update", description: memberId ? "Horaires d'un membre modifiés" : "Horaires de l'établissement modifiés" });
  });

  revalidatePath("/app/horaires");
  return { ok: true };
}

export async function setScheduleMode(mode: "shared" | "per_member"): Promise<ActionResult> {
  const ctx = await requireContext(undefined, { app: "rdv" });
  if (!ctx.can("availability.manageShared")) return FORBIDDEN;
  const value = z.enum(["shared", "per_member"]).parse(mode);

  await db.transaction(async (tx) => {
    await tx.update(bookingSettings).set({ scheduleMode: value }).where(eq(bookingSettings.businessId, ctx.business.id));
    // En passant aux horaires individuels, chaque membre sans horaires part des horaires communs.
    if (value === "per_member") {
      const shared = await tx.select().from(weeklyHours).where(and(eq(weeklyHours.businessId, ctx.business.id), isNull(weeklyHours.memberId)));
      const team = await tx.select({ id: members.id }).from(members).where(and(eq(members.businessId, ctx.business.id), eq(members.status, "active")));
      const existing = new Set((await tx.select({ m: weeklyHours.memberId }).from(weeklyHours).where(eq(weeklyHours.businessId, ctx.business.id))).map((r) => r.m));
      const copies = team
        .filter((m) => !existing.has(m.id))
        .flatMap((m) => shared.map((h) => ({ businessId: ctx.business.id, memberId: m.id, weekday: h.weekday, startTime: h.startTime, endTime: h.endTime })));
      if (copies.length) await tx.insert(weeklyHours).values(copies);
    }
  });

  revalidatePath("/app/horaires");
  return { ok: true };
}

const exceptionSchema = z
  .object({
    memberIds: z.string().transform((x) => [...new Set(x.split(",").filter(Boolean))]).pipe(z.array(z.uuid()).max(50)),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début invalide."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin invalide."),
    type: z.enum(["closed", "hours"]),
    start: z.string(),
    end: z.string(),
    reason: z.string().trim().max(120),
  })
  .refine((v) => v.from <= v.to, { message: "La date de fin doit être après la date de début.", path: ["to"] })
  .refine((v) => v.type === "closed" || range.safeParse({ start: v.start, end: v.end }).success, { message: "Horaires spéciaux invalides.", path: ["start"] });

export async function addException(input: Record<string, string>): Promise<ActionResult> {
  const ctx = await requireContext(undefined, { app: "rdv" });
  const parsed = exceptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const v = parsed.data;
  // Liste vide = tout l'établissement.
  const targets: (string | null)[] = v.memberIds.length ? v.memberIds : [null];
  try {
    for (const memberId of targets) await assertCanEdit(ctx, memberId, memberId ? "timeOff" : "schedule");
  } catch {
    return FORBIDDEN;
  }

  const days: string[] = [];
  for (let d = new Date(v.from + "T12:00:00Z"); d <= new Date(v.to + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
    if (days.length > 366) return { ok: false, error: "Une période ne peut pas dépasser un an." };
  }

  await db.transaction(async (tx) => {
    for (const memberId of targets) {
      // Une seule exception par jour et par personne : la nouvelle remplace l'ancienne.
      await tx
        .delete(scheduleExceptions)
        .where(and(eq(scheduleExceptions.businessId, ctx.business.id), inArray(scheduleExceptions.date, days), memberId ? eq(scheduleExceptions.memberId, memberId) : isNull(scheduleExceptions.memberId)));
      await tx.insert(scheduleExceptions).values(
        days.map((date) => ({
          businessId: ctx.business.id,
          memberId,
          date,
          isClosed: v.type === "closed",
          hours: v.type === "hours" ? [{ start: v.start, end: v.end }] : [],
          reason: v.reason || null,
        })),
      );
    }
    await tx.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "schedule.exception", description: `${v.type === "closed" ? "Fermeture" : "Horaires spéciaux"} du ${v.from}${v.to !== v.from ? ` au ${v.to}` : ""}` });
  });

  revalidatePath("/app/horaires");
  return { ok: true };
}

export async function deleteException(id: string): Promise<ActionResult> {
  const ctx = await requireContext(undefined, { app: "rdv" });
  const [e] = await db.select().from(scheduleExceptions).where(and(eq(scheduleExceptions.id, z.uuid().parse(id)), eq(scheduleExceptions.businessId, ctx.business.id)));
  if (!e) return { ok: false, error: "Introuvable." };
  try {
    await assertCanEdit(ctx, e.memberId, e.memberId ? "timeOff" : "schedule");
  } catch {
    return FORBIDDEN;
  }
  await db.delete(scheduleExceptions).where(eq(scheduleExceptions.id, e.id));
  revalidatePath("/app/horaires");
  return { ok: true };
}

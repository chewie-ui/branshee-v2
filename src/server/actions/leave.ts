"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, businesses, leaveAllowances, leaveRequests, members, scheduleExceptions, users } from "@/db/schema";
import { LEAVE_KINDS, datesBetween, fmtDays, fmtRange, isLeaveKind, leaveHalfDays, type LeavePeriod } from "@/lib/leave";
import { isDay } from "@/lib/planning";
import { requireContext, type AppContext } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { leaveRights } from "@/server/leave";

type Result = { ok: true; message?: string } | { ok: false; error: string };
const log = (ctx: AppContext, action: string, description: string) => db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action, description });
const origin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");
const refresh = () => {
  revalidatePath("/app/conges", "layout");
  revalidatePath("/app/planning");
};

const requestSchema = z.object({
  memberId: z.uuid().optional(),
  kind: z.string().refine(isLeaveKind, "Type d'absence invalide."),
  start: z.string().refine(isDay, "Date de début invalide."),
  end: z.string().refine(isDay, "Date de fin invalide."),
  period: z.enum(["full", "am", "pm"]),
  note: z.string().trim().max(500),
});

/** Jours fermés dans l'agenda RDV pour un congé validé (journées entières ; une saisie manuelle existante est gardée). */
async function closeAgenda(r: typeof leaveRequests.$inferSelect) {
  if (r.period !== "full") return;
  const days = datesBetween(r.startDate, r.endDate);
  const taken = await db.select({ date: scheduleExceptions.date }).from(scheduleExceptions).where(and(eq(scheduleExceptions.businessId, r.businessId), eq(scheduleExceptions.memberId, r.memberId), inArray(scheduleExceptions.date, days)));
  const busy = new Set(taken.map((t) => t.date));
  const label = LEAVE_KINDS[isLeaveKind(r.kind) ? r.kind : "autre"].label;
  const rows = days.filter((d) => !busy.has(d)).map((date) => ({ businessId: r.businessId, memberId: r.memberId, date, isClosed: true, hours: [], reason: label, leaveRequestId: r.id }));
  if (rows.length) await db.insert(scheduleExceptions).values(rows);
}
const reopenAgenda = (id: string) => db.delete(scheduleExceptions).where(eq(scheduleExceptions.leaveRequestId, id));

async function memberEmail(memberId: string) {
  const [m] = await db.select({ name: members.displayName, invite: members.inviteEmail, email: users.email }).from(members).leftJoin(users, eq(users.id, members.userId)).where(eq(members.id, memberId));
  return m ? { name: m.name, email: m.email ?? m.invite } : null;
}

/** Demander une absence (pour soi), ou l'encoder directement pour quelqu'un si on valide les congés. */
export async function requestLeave(input: z.input<typeof requestSchema>): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const v = requestSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  const { approve } = leaveRights(ctx);
  const memberId = d.memberId ?? ctx.member.id;
  if (memberId !== ctx.member.id && !approve) return { ok: false, error: "Vous ne pouvez demander des congés que pour vous-même." };
  if (d.end < d.start) return { ok: false, error: "La date de fin est avant la date de début." };
  if (datesBetween(d.start, d.end).length > 366) return { ok: false, error: "Une absence ne peut pas dépasser un an." };
  const period: LeavePeriod = d.start === d.end ? d.period : "full";
  const [m] = await db.select({ id: members.id, name: members.displayName }).from(members).where(and(eq(members.id, memberId), eq(members.businessId, ctx.business.id)));
  if (!m) return { ok: false, error: "Membre introuvable." };
  const [overlap] = await db
    .select({ id: leaveRequests.id })
    .from(leaveRequests)
    .where(and(eq(leaveRequests.memberId, memberId), inArray(leaveRequests.status, ["pending", "approved"]), sql`${leaveRequests.startDate} <= ${d.end} and ${leaveRequests.endDate} >= ${d.start}`));
  if (overlap) return { ok: false, error: "Une absence existe déjà sur ces dates." };

  // Celui qui valide les congés n'a pas besoin de se demander l'autorisation (ni de la demander pour un autre).
  const status = approve ? "approved" : "pending";
  const [row] = await db
    .insert(leaveRequests)
    .values({ businessId: ctx.business.id, memberId, kind: d.kind, startDate: d.start, endDate: d.end, period, status, note: d.note || null, createdById: ctx.user.id, ...(approve ? { decidedById: ctx.user.id, decidedAt: new Date() } : {}) })
    .returning();
  if (status === "approved") await closeAgenda(row!);
  const label = LEAVE_KINDS[d.kind as keyof typeof LEAVE_KINDS].label;
  const when = fmtRange(d.start, d.end, period);
  await log(ctx, "leave.request", `${label} ${when} : ${m.name}${status === "approved" ? " (validé)" : " (demande)"}`);
  if (status === "pending") {
    after(async () => {
      const [owner] = await db.select({ email: users.email, biz: businesses.name }).from(businesses).innerJoin(users, eq(users.id, businesses.ownerId)).where(eq(businesses.id, ctx.business.id));
      if (owner) await sendEmail({ to: owner.email, ...emails.leaveRequested({ businessName: owner.biz, name: m.name, kind: label, when, days: fmtDays(leaveHalfDays(d.start, d.end, period)), note: d.note || null, url: `${origin()}/app/conges` }), template: "leave_requested", businessId: ctx.business.id }).catch((e) => console.error("[congés] email :", e));
    });
  }
  refresh();
  return { ok: true, message: status === "approved" ? `${label} enregistré ${when}.` : "Demande envoyée : vous serez prévenu de la réponse." };
}

/** Valider ou refuser une demande en attente. */
export async function decideLeave(id: string, approve: boolean, note = ""): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  if (!leaveRights(ctx).approve) return { ok: false, error: "Seul le responsable peut valider les congés." };
  const parsed = z.object({ id: z.uuid(), note: z.string().trim().max(500) }).safeParse({ id, note });
  if (!parsed.success) return { ok: false, error: "Demande introuvable." };
  const [row] = await db
    .update(leaveRequests)
    .set({ status: approve ? "approved" : "refused", decisionNote: parsed.data.note || null, decidedById: ctx.user.id, decidedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(leaveRequests.id, parsed.data.id), eq(leaveRequests.businessId, ctx.business.id), eq(leaveRequests.status, "pending")))
    .returning();
  if (!row) return { ok: false, error: "Cette demande a déjà été traitée." };
  if (approve) await closeAgenda(row);
  const label = LEAVE_KINDS[isLeaveKind(row.kind) ? row.kind : "autre"].label;
  const when = fmtRange(row.startDate, row.endDate, row.period as LeavePeriod);
  const who = await memberEmail(row.memberId);
  await log(ctx, approve ? "leave.approve" : "leave.refuse", `${label} ${when} ${approve ? "validé" : "refusé"} : ${who?.name ?? ""}`);
  if (who?.email && row.memberId !== ctx.member.id) {
    after(() => sendEmail({ to: who.email!, ...emails.leaveDecided({ businessName: ctx.business.name, name: who.name.split(" ")[0] ?? who.name, kind: label, when, approved: approve, note: parsed.data.note || null, url: `${origin()}/app/conges` }), template: "leave_decided", businessId: ctx.business.id }).catch((e) => console.error("[congés] email :", e)));
  }
  refresh();
  return { ok: true, message: approve ? "Demande validée." : "Demande refusée." };
}

/** Annuler une absence : la sienne (en attente ou à venir), ou n'importe laquelle pour le responsable. L'agenda est rouvert. */
export async function cancelLeave(id: string): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Absence introuvable." };
  const [row] = await db.select().from(leaveRequests).where(and(eq(leaveRequests.id, parsed.data), eq(leaveRequests.businessId, ctx.business.id)));
  if (!row || row.status === "cancelled" || row.status === "refused") return { ok: false, error: "Absence introuvable." };
  if (row.memberId !== ctx.member.id && !leaveRights(ctx).approve) return { ok: false, error: "Vous ne pouvez annuler que vos propres absences." };
  await db.update(leaveRequests).set({ status: "cancelled", updatedAt: new Date() }).where(eq(leaveRequests.id, row.id));
  await reopenAgenda(row.id);
  await log(ctx, "leave.cancel", `Absence annulée ${fmtRange(row.startDate, row.endDate, row.period as LeavePeriod)}`);
  refresh();
  return { ok: true, message: "Absence annulée." };
}

/** Jours de congé par an d'un membre (vide = pas de solde suivi). */
export async function setAllowance(memberId: string, year: number, days: number | null): Promise<Result> {
  const ctx = await requireContext();
  if (!leaveRights(ctx).approve) return { ok: false, error: "Seul le responsable peut modifier les soldes." };
  const v = z.object({ memberId: z.uuid(), year: z.number().int().min(2000).max(2100), days: z.number().min(0).max(366).multipleOf(0.5).nullable() }).safeParse({ memberId, year, days });
  if (!v.success) return { ok: false, error: "Nombre de jours invalide (demi-journées acceptées)." };
  const [m] = await db.select({ id: members.id }).from(members).where(and(eq(members.id, memberId), eq(members.businessId, ctx.business.id)));
  if (!m) return { ok: false, error: "Membre introuvable." };
  if (v.data.days === null) await db.delete(leaveAllowances).where(and(eq(leaveAllowances.memberId, memberId), eq(leaveAllowances.year, year)));
  else await db.insert(leaveAllowances).values({ businessId: ctx.business.id, memberId, year, halfDays: Math.round(v.data.days * 2) }).onConflictDoUpdate({ target: [leaveAllowances.memberId, leaveAllowances.year], set: { halfDays: Math.round(v.data.days * 2), updatedAt: new Date() } });
  revalidatePath("/app/conges", "layout");
  return { ok: true, message: "Solde enregistré." };
}

/** Appliquer le même nombre de jours à toute l'équipe qui n'a pas encore de solde cette année. */
export async function setAllowanceForAll(year: number, days: number): Promise<Result> {
  const ctx = await requireContext();
  if (!leaveRights(ctx).approve) return { ok: false, error: "Seul le responsable peut modifier les soldes." };
  const v = z.object({ year: z.number().int().min(2000).max(2100), days: z.number().min(0).max(366).multipleOf(0.5) }).safeParse({ year, days });
  if (!v.success) return { ok: false, error: "Nombre de jours invalide." };
  const team = await db.select({ id: members.id }).from(members).leftJoin(leaveAllowances, and(eq(leaveAllowances.memberId, members.id), eq(leaveAllowances.year, year))).where(and(eq(members.businessId, ctx.business.id), eq(members.isActive, true), inArray(members.status, ["active", "invited"]), isNull(leaveAllowances.id)));
  if (team.length) await db.insert(leaveAllowances).values(team.map((t) => ({ businessId: ctx.business.id, memberId: t.id, year, halfDays: Math.round(days * 2) })));
  revalidatePath("/app/conges", "layout");
  return { ok: true, message: team.length ? `${days} jours appliqués à ${team.length} personne${team.length > 1 ? "s" : ""}.` : "Tout le monde a déjà un solde cette année." };
}

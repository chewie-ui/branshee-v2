import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { members, shifts } from "@/db/schema";
import { addDays } from "@/lib/planning";
import type { AppContext } from "@/server/context";

export type ShiftView = { id: string; memberId: string; day: string; start: string; end: string; breakMinutes: number; label: string | null; note: string | null };
export type PlanningMember = { id: string; name: string; role: string | null; color: string | null; isMe: boolean };

/** Qui voit quoi : le responsable et ceux qui gèrent les horaires des autres voient (et modifient) tout ; les autres, leur planning. */
export function planningRights(ctx: AppContext) {
  const manage = ctx.member.isOwner || ctx.can("availability.manageOthersSchedule");
  return { manage, seeAll: manage || ctx.can("team.view") };
}

/** Membres affichés dans le planning (actifs et invités), et plages de la semaine. */
export async function weekPlanning(ctx: AppContext, monday: string) {
  const { seeAll } = planningRights(ctx);
  const team = await db
    .select({ id: members.id, name: members.displayName, role: members.roleLabel, color: members.calendarColor, isOwner: members.isOwner })
    .from(members)
    .where(and(eq(members.businessId, ctx.business.id), eq(members.isActive, true), inArray(members.status, ["active", "invited"]), seeAll ? undefined : eq(members.id, ctx.member.id)))
    .orderBy(asc(members.createdAt));
  const ids = team.map((m) => m.id);
  const rows = ids.length
    ? await db
        .select()
        .from(shifts)
        .where(and(eq(shifts.businessId, ctx.business.id), inArray(shifts.memberId, ids), gte(shifts.day, monday), lte(shifts.day, addDays(monday, 6))))
        .orderBy(asc(shifts.day), asc(shifts.startTime))
    : [];
  return {
    members: team.map<PlanningMember>((m) => ({ id: m.id, name: m.name, role: m.role, color: m.color, isMe: m.id === ctx.member.id })),
    shifts: rows.map<ShiftView>((r) => ({ id: r.id, memberId: r.memberId, day: r.day, start: r.startTime.slice(0, 5), end: r.endTime.slice(0, 5), breakMinutes: r.breakMinutes, label: r.label, note: r.note })),
  };
}

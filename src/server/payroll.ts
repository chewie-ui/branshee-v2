import "server-only";
import { and, asc, eq, gte, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { leaveRequests, members, payrollClosures, payrollEntries, payrollProfiles, shifts } from "@/db/schema";
import { LEAVE_KINDS } from "@/lib/leave";
import { contractMinutes, grossEstimate, leaveHalfDaysInMonth, monthBounds } from "@/lib/payroll";
import { shiftMinutes } from "@/lib/planning";
import type { AppContext } from "@/server/context";

/** Données de salaire : réservées au titulaire et à qui gère les réglages. */
export const payrollRights = (ctx: AppContext) => ({ manage: ctx.member.isOwner || ctx.can("settings.manage") });

export type PayrollRowData = {
  memberId: string;
  name: string;
  profile: { weeklyMinutes: number; payType: string; rateCents: number; mealVouchers: boolean; externalId: string | null } | null;
  plannedMinutes: number;
  adjustMinutes: number;
  minutes: number;
  contract: number | null;
  days: number;
  mealVouchers: number;
  absences: { kind: string; label: string; days: number }[];
  bonusCents: number;
  km: number;
  note: string;
  gross: number | null;
};
export type PayrollRow = PayrollRowData;

/** Prestations du mois par membre : heures du Planning, absences des Congés, ajustements, brut indicatif. */
export async function payrollMonth(businessId: string, month: string) {
  const { from, to } = monthBounds(month);
  const [team, profiles, entries, work, leaves, [closure]] = await Promise.all([
    // Membres actifs + ceux partis depuis mais qui ont presté ou ont un ajustement ce mois-là.
    db
      .select({ id: members.id, name: members.displayName })
      .from(members)
      .where(and(eq(members.businessId, businessId), or(eq(members.status, "active"), sql`exists (select 1 from "shifts" s where s.member_id = "members"."id" and s.day between ${from}::date and ${to}::date)`, sql`exists (select 1 from "payroll_entries" pe where pe.member_id = "members"."id" and pe.month = ${month})`)))
      .orderBy(asc(members.displayName)),
    db.select().from(payrollProfiles).where(eq(payrollProfiles.businessId, businessId)),
    db.select().from(payrollEntries).where(and(eq(payrollEntries.businessId, businessId), eq(payrollEntries.month, month))),
    db.select({ memberId: shifts.memberId, day: shifts.day, start: shifts.startTime, end: shifts.endTime, brk: shifts.breakMinutes }).from(shifts).where(and(eq(shifts.businessId, businessId), gte(shifts.day, from), lte(shifts.day, to))),
    db.select().from(leaveRequests).where(and(eq(leaveRequests.businessId, businessId), eq(leaveRequests.status, "approved"), lte(leaveRequests.startDate, to), gte(leaveRequests.endDate, from))),
    db.select().from(payrollClosures).where(and(eq(payrollClosures.businessId, businessId), eq(payrollClosures.month, month))),
  ]);
  if (closure?.snapshot) return { rows: closure.snapshot as PayrollRowData[], closedAt: closure.closedAt };
  const rows: PayrollRowData[] = team.map((m) => {
    const p = profiles.find((x) => x.memberId === m.id) ?? null;
    const e = entries.find((x) => x.memberId === m.id) ?? null;
    const mine = work.filter((w) => w.memberId === m.id);
    const planned = mine.reduce((a, w) => a + shiftMinutes(w.start, w.end, w.brk), 0);
    const days = new Set(mine.map((w) => w.day)).size;
    const absences: Record<string, number> = {};
    for (const l of leaves.filter((x) => x.memberId === m.id)) {
      const h = leaveHalfDaysInMonth(l.startDate, l.endDate, l.period as "full" | "am" | "pm", month);
      if (h) absences[l.kind] = (absences[l.kind] ?? 0) + h;
    }
    const minutes = planned + (e?.adjustMinutes ?? 0);
    return {
      memberId: m.id,
      name: m.name,
      profile: p ? { weeklyMinutes: p.weeklyMinutes, payType: p.payType, rateCents: p.rateCents, mealVouchers: p.mealVouchers, externalId: p.externalId } : null,
      plannedMinutes: planned,
      adjustMinutes: e?.adjustMinutes ?? 0,
      minutes,
      contract: p ? contractMinutes(p.weeklyMinutes, month) : null,
      days,
      mealVouchers: p?.mealVouchers ? days : 0,
      absences: Object.entries(absences).map(([kind, half]) => ({ kind, label: LEAVE_KINDS[kind as keyof typeof LEAVE_KINDS]?.label ?? kind, days: half / 2 })),
      bonusCents: e?.bonusCents ?? 0,
      km: e?.km ?? 0,
      note: e?.note ?? "",
      gross: p ? grossEstimate(p, minutes, e?.bonusCents ?? 0) : null,
    };
  });
  return { rows, closedAt: closure?.closedAt ?? null };
}

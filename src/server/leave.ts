import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { leaveAllowances, leaveRequests, members } from "@/db/schema";
import { addDays } from "@/lib/planning";
import { LEAVE_KINDS, leaveHalfDays, type LeaveKind, type LeavePeriod, type LeaveStatus } from "@/lib/leave";
import type { AppContext } from "@/server/context";

export type LeaveView = { id: string; memberId: string; memberName: string; kind: LeaveKind; start: string; end: string; period: LeavePeriod; status: LeaveStatus; note: string | null; decisionNote: string | null; halfDays: number; createdAt: string };
export type LeaveMember = { id: string; name: string; role: string | null; isMe: boolean };
export type LeaveBalance = { memberId: string; allowance: number | null; taken: number; planned: number; pending: number };

/** Qui valide : le responsable et ceux qui gèrent les congés des autres. Les autres demandent pour eux-mêmes. */
export function leaveRights(ctx: AppContext) {
  const approve = ctx.member.isOwner || ctx.can("availability.manageOthersTimeOff");
  return { approve, seeAll: approve || ctx.can("team.view") };
}

export async function leaveMembers(ctx: AppContext): Promise<LeaveMember[]> {
  const { seeAll } = leaveRights(ctx);
  const rows = await db
    .select({ id: members.id, name: members.displayName, role: members.roleLabel })
    .from(members)
    .where(and(eq(members.businessId, ctx.business.id), eq(members.isActive, true), inArray(members.status, ["active", "invited"]), seeAll ? undefined : eq(members.id, ctx.member.id)))
    .orderBy(asc(members.createdAt));
  return rows.map((m) => ({ ...m, isMe: m.id === ctx.member.id }));
}

const view = (r: typeof leaveRequests.$inferSelect, name: string): LeaveView => ({
  id: r.id,
  memberId: r.memberId,
  memberName: name,
  kind: (r.kind in LEAVE_KINDS ? r.kind : "autre") as LeaveKind,
  start: r.startDate,
  end: r.endDate,
  period: (["full", "am", "pm"].includes(r.period) ? r.period : "full") as LeavePeriod,
  status: r.status as LeaveStatus,
  note: r.note,
  decisionNote: r.decisionNote,
  halfDays: leaveHalfDays(r.startDate, r.endDate, r.period as LeavePeriod),
  createdAt: r.createdAt.toISOString(),
});

/** Demandes visibles (toutes pour qui voit l'équipe, sinon les siennes), entre deux dates si précisé. */
export async function listLeave(ctx: AppContext, opts: { from?: string; to?: string; statuses?: LeaveStatus[]; limit?: number } = {}) {
  const team = await leaveMembers(ctx);
  const ids = team.map((m) => m.id);
  if (!ids.length) return [];
  const rows = await db
    .select({ r: leaveRequests, name: members.displayName })
    .from(leaveRequests)
    .innerJoin(members, eq(members.id, leaveRequests.memberId))
    .where(
      and(
        eq(leaveRequests.businessId, ctx.business.id),
        inArray(leaveRequests.memberId, ids),
        opts.to ? lte(leaveRequests.startDate, opts.to) : undefined,
        opts.from ? gte(leaveRequests.endDate, opts.from) : undefined,
        opts.statuses ? inArray(leaveRequests.status, opts.statuses) : ne(leaveRequests.status, "cancelled"),
      ),
    )
    .orderBy(desc(leaveRequests.startDate))
    .limit(opts.limit ?? 500);
  return rows.map(({ r, name }) => view(r, name));
}

/** Soldes de l'année : jours prévus au contrat, congés pris (passés), à venir et en attente, en demi-journées. */
export async function leaveBalances(ctx: AppContext, year: number, today: string): Promise<LeaveBalance[]> {
  const team = await leaveMembers(ctx);
  if (!team.length) return [];
  const [allow, list] = await Promise.all([
    db.select().from(leaveAllowances).where(and(eq(leaveAllowances.businessId, ctx.business.id), eq(leaveAllowances.year, year), inArray(leaveAllowances.memberId, team.map((m) => m.id)))),
    listLeave(ctx, { from: `${year}-01-01`, to: `${year}-12-31`, statuses: ["approved", "pending"] }),
  ]);
  return team.map((m) => {
    const mine = list.filter((l) => l.memberId === m.id && LEAVE_KINDS[l.kind].counted);
    // Demande à cheval sur deux années : seuls les jours de l'année comptent.
    // Partie d'une absence entre deux dates (bornée à l'année) ; une absence en cours est coupée : passé = pris, reste = prévu.
    const part = (l: LeaveView, from: string, to: string) => {
      const a = l.start > from ? l.start : from;
      const b = l.end < to ? l.end : to;
      return a > b ? 0 : leaveHalfDays(a, b, a === l.start && b === l.end ? l.period : "full");
    };
    const yearStart = `${year}-01-01`, yearEnd = `${year}-12-31`;
    const yesterday = addDays(today, -1);
    const approved = mine.filter((l) => l.status === "approved");
    return {
      memberId: m.id,
      allowance: allow.find((a) => a.memberId === m.id)?.halfDays ?? null,
      taken: approved.reduce((s, l) => s + part(l, yearStart, yesterday < yearEnd ? yesterday : yearEnd), 0),
      planned: approved.reduce((s, l) => s + part(l, today > yearStart ? today : yearStart, yearEnd), 0),
      pending: mine.filter((l) => l.status === "pending").reduce((s, l) => s + part(l, yearStart, yearEnd), 0),
    };
  });
}

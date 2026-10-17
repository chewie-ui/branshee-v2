import "server-only";
import { and, eq, gte, inArray, isNull, lt, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, bookingSettings, businesses, groupSessions, members, scheduleExceptions, serviceMembers, services, weeklyHours } from "@/db/schema";
import { computeSlots, type DayException, type MemberAvailability } from "@/lib/booking/slots";

const hhmm = (t: string) => t.slice(0, 5);

/**
 * Charge tout ce qu'il faut depuis la base puis délègue au moteur pur `computeSlots`.
 * `days` : jours "YYYY-MM-DD" dans le fuseau de l'établissement.
 */
export async function getAvailableSlots(params: { businessId: string; serviceId: string; days: string[]; memberId?: string; now?: Date; ignoreOnlineRules?: boolean }) {
  const { businessId, serviceId, days } = params;
  if (days.length === 0) return {};

  const [biz] = await db.select({ timezone: businesses.timezone }).from(businesses).where(eq(businesses.id, businessId));
  const [settings] = await db.select().from(bookingSettings).where(eq(bookingSettings.businessId, businessId));
  const [service] = await db.select().from(services).where(and(eq(services.id, serviceId), eq(services.businessId, businessId), eq(services.isActive, true)));
  if (!biz || !settings || !service || service.kind !== "individual") return {};

  // Membres qui réalisent la prestation (aucune restriction = toute l'équipe réservable).
  const restricted = (await db.select({ id: serviceMembers.memberId }).from(serviceMembers).where(eq(serviceMembers.serviceId, serviceId))).map((r) => r.id);
  let team = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.businessId, businessId), eq(members.status, "active"), eq(members.isActive, true), eq(members.isBookable, true)));
  if (restricted.length) team = team.filter((m) => restricted.includes(m.id));
  if (params.memberId) team = team.filter((m) => m.id === params.memberId);
  if (team.length === 0) return {};
  const ids = team.map((m) => m.id);

  const sorted = [...days].sort();
  const [hours, exceptions] = await Promise.all([
    db.select().from(weeklyHours).where(and(eq(weeklyHours.businessId, businessId), settings.scheduleMode === "shared" ? isNull(weeklyHours.memberId) : inArray(weeklyHours.memberId, ids))),
    db
      .select()
      .from(scheduleExceptions)
      .where(and(eq(scheduleExceptions.businessId, businessId), gte(scheduleExceptions.date, sorted[0]!), lte(scheduleExceptions.date, sorted.at(-1)!), or(isNull(scheduleExceptions.memberId), inArray(scheduleExceptions.memberId, ids)))),
  ]);

  const weeklyFor = (memberId: string | null) => {
    const out: Record<number, { start: string; end: string }[]> = {};
    for (const h of hours.filter((x) => x.memberId === memberId)) (out[h.weekday] ??= []).push({ start: hhmm(h.startTime), end: hhmm(h.endTime) });
    for (const list of Object.values(out)) list.sort((a, b) => a.start.localeCompare(b.start));
    return out;
  };
  const exceptionsFor = (memberId: string | null) => {
    const out: Record<string, DayException> = {};
    for (const e of exceptions.filter((x) => x.memberId === memberId)) out[e.date] = { isClosed: e.isClosed, hours: e.hours };
    return out;
  };

  const shared = weeklyFor(null);
  const availability: MemberAvailability[] = ids.map((id) => ({
    memberId: id,
    weekly: settings.scheduleMode === "shared" ? shared : weeklyFor(id),
    exceptions: exceptionsFor(id),
  }));

  // RDV et blocages qui occupent l'agenda (les demandes en attente bloquent aussi le créneau).
  const windowStart = new Date(sorted[0]! + "T00:00:00Z");
  windowStart.setUTCDate(windowStart.getUTCDate() - 1);
  const windowEnd = new Date(sorted.at(-1)! + "T00:00:00Z");
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 2);
  const busyRows = await db
    .select({ memberId: appointments.memberId, start: appointments.startsAt, end: appointments.endsAt })
    .from(appointments)
    .where(and(eq(appointments.businessId, businessId), inArray(appointments.memberId, ids), ne(appointments.status, "cancelled"), lt(appointments.startsAt, windowEnd), gte(appointments.endsAt, windowStart)));

  // Séances de cours collectifs animées par un membre : elles bloquent ses RDV individuels (option de la prestation).
  const sessionRows = await db
    .select({ memberId: groupSessions.memberId, start: groupSessions.startsAt, end: groupSessions.endsAt })
    .from(groupSessions)
    .innerJoin(services, eq(services.id, groupSessions.serviceId))
    .where(and(eq(services.businessId, businessId), eq(services.blocksIndividual, true), inArray(groupSessions.memberId, ids), isNull(groupSessions.cancelledAt), lt(groupSessions.startsAt, windowEnd), gte(groupSessions.endsAt, windowStart)));
  busyRows.push(...sessionRows);

  return computeSlots({
    timezone: biz.timezone,
    days: sorted,
    now: params.now ?? new Date(),
    durationMin: service.durationMin,
    rules: {
      slotMode: settings.slotMode,
      slotIntervalMin: settings.slotIntervalMin,
      bufferBeforeMin: settings.bufferBeforeMin,
      bufferAfterMin: settings.bufferAfterMin,
      minLeadMin: params.ignoreOnlineRules ? null : settings.minLeadMin,
      horizonDays: params.ignoreOnlineRules ? null : settings.horizonDays,
    },
    members: availability,
    businessExceptions: exceptionsFor(null),
    busy: busyRows.filter((b): b is { memberId: string; start: Date; end: Date } => b.memberId !== null),
  });
}

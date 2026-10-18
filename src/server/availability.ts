import "server-only";
import { and, eq, gte, inArray, isNull, lt, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, bookingSettings, businesses, members, scheduleExceptions, serviceHours, serviceMembers, services, weeklyHours } from "@/db/schema";
import { computeSlots, type DayException, type MemberAvailability } from "@/lib/booking/slots";
import { groupBusy } from "@/server/group-sessions";
import { googleBusy } from "@/server/google";

const hhmm = (t: string) => t.slice(0, 5);

/**
 * Charge tout ce qu'il faut depuis la base puis délègue au moteur pur `computeSlots`.
 * `days` : jours "YYYY-MM-DD" dans le fuseau de l'établissement.
 */
export async function getAvailableSlots(params: { businessId: string; serviceId?: string | null; days: string[]; memberId?: string; now?: Date; ignoreOnlineRules?: boolean; excludeAppointmentId?: string; /** Durée libre (RDV sans prestation, créé par le pro). */ durationMin?: number }) {
  const { businessId, serviceId, days } = params;
  if (days.length === 0) return {};

  const [biz] = await db.select({ timezone: businesses.timezone }).from(businesses).where(eq(businesses.id, businessId));
  const [settings] = await db.select().from(bookingSettings).where(eq(bookingSettings.businessId, businessId));
  const [service] = serviceId ? await db.select().from(services).where(and(eq(services.id, serviceId), eq(services.businessId, businessId), eq(services.isActive, true))) : [null];
  if (!biz || !settings) return {};
  if (serviceId ? !service || service.kind !== "individual" : !params.durationMin) return {};

  // Membres qui réalisent la prestation (aucune restriction = toute l'équipe réservable).
  const restricted = service ? (await db.select({ id: serviceMembers.memberId }).from(serviceMembers).where(eq(serviceMembers.serviceId, service.id))).map((r) => r.id) : [];
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
    .select({ memberId: appointments.memberId, start: appointments.startsAt, end: appointments.endsAt, kind: appointments.kind, status: appointments.status })
    .from(appointments)
    .where(
      and(
        eq(appointments.businessId, businessId),
        // Un blocage sans membre (« tout l'établissement ») bloque toute l'équipe.
        or(inArray(appointments.memberId, ids), and(isNull(appointments.memberId), eq(appointments.kind, "block"))),
        ne(appointments.status, "cancelled"),
        // Report d'un RDV : il ne doit pas se bloquer lui-même.
        params.excludeAppointmentId ? ne(appointments.id, params.excludeAppointmentId) : undefined,
        lt(appointments.startsAt, windowEnd),
        gte(appointments.endsAt, windowStart),
      ),
    );

  // Cours collectifs qui bloquent les RDV individuels de leurs animateurs (séances enregistrées et récurrentes).
  const sessionRows = await groupBusy(businessId, ids, { from: windowStart, to: windowEnd }, biz.timezone);
  // Événements personnels des agendas Google connectés (forfait Pro et plus).
  const googleRows = await googleBusy(ids, windowStart, windowEnd).catch(() => []);
  const allBusy: { memberId: string | null; start: Date; end: Date }[] = [...busyRows, ...sessionRows, ...googleRows];
  const busy = allBusy.flatMap((b) => (b.memberId ? [{ ...b, memberId: b.memberId }] : ids.map((id) => ({ ...b, memberId: id }))));

  // Plages propres à la prestation (aucune = toutes les heures d'ouverture).
  const windowRows = service ? await db.select().from(serviceHours).where(eq(serviceHours.serviceId, service.id)) : [];
  let serviceWindows: Record<number, { start: string; end: string }[]> | null = null;
  if (windowRows.length) {
    serviceWindows = {};
    for (const w of windowRows) (serviceWindows[w.weekday] ??= []).push({ start: hhmm(w.startTime), end: hhmm(w.endTime) });
  }

  const sg = settings.smartGrouping;
  const grouping =
    sg.enabled && !params.ignoreOnlineRules
      ? { windowHours: sg.windowHours, weekdays: sg.weekdays, anchors: busyRows.filter((b): b is typeof b & { memberId: string } => !!b.memberId && b.kind === "appointment" && b.status === "confirmed").map((b) => ({ memberId: b.memberId, start: b.start, end: b.end })) }
      : null;

  return computeSlots({
    serviceWindows,
    grouping,
    timezone: biz.timezone,
    days: sorted,
    now: params.now ?? new Date(),
    // Durée variable (« 30 à 45 min ») : on bloque toujours la durée maximale pour ne jamais déborder.
    durationMin: params.durationMin ?? service!.durationMaxMin ?? service!.durationMin,
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
    busy,
  });
}

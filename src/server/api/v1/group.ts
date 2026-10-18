import "server-only";
import { and, asc, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, groupSessions, serviceMembers, members, services } from "@/db/schema";
import { cancelSession, createSessions, restoreSession, saveRecurrence } from "@/server/actions/group-sessions";
import { cancelAppointment } from "@/server/actions/appointments";
import { groupServicesOf, sessionsFor, type SessionView } from "@/server/group-sessions";
import { parseVirtualSessionId } from "@/lib/booking/recurrence";
import { bool, ensureOk, fail, formData, invalid, type ApiRequest, type Route } from "@/server/api/http";
import { at, dayOf, isDay, isTime, needCtx, timeOf } from "@/server/api/v1/shared";
import type { AppContext } from "@/server/context";

const WEEKS = 8;

async function course(ctx: AppContext, serviceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(serviceId)) return fail(404, "not_found", "Cours introuvable.");
  const [svc] = await groupServicesOf(ctx.business.id, [serviceId]);
  return svc ?? fail(404, "not_found", "Cours introuvable.");
}

type Svc = Awaited<ReturnType<typeof groupServicesOf>>[number];

async function courseDto(ctx: AppContext, svc: Svc, sessions?: SessionView[]) {
  const tz = ctx.business.timezone;
  const now = new Date();
  const list = sessions ?? (await sessionsFor([svc], { from: new Date(now.getTime() - 7 * 86400000), to: new Date(now.getTime() + WEEKS * 7 * 86400000) }, tz));
  // Dates ponctuelles = séances enregistrées hors récurrence. `index` porte l'identifiant de la séance (il sert à la supprimer).
  const own = list.filter((s) => s.serviceId === svc.id && !s.virtual);
  return {
    serviceId: svc.id,
    name: svc.name,
    color: svc.color,
    active: svc.isActive,
    capacity: svc.capacity,
    duration: svc.durationMin,
    recurring: { enabled: !!svc.recurrence?.weekdays.length, weekdays: svc.recurrence?.weekdays ?? [], startTime: svc.recurrence?.startTime ?? "" },
    sessions: own.map((s) => ({ index: s.id, date: dayOf(s.startsAt, tz), startTime: timeOf(s.startsAt, tz), endTime: timeOf(s.endsAt, tz), past: s.startsAt < now })),
  };
}

async function list() {
  const ctx = await needCtx("groupSessions.view");
  const tz = ctx.business.timezone;
  const svcs = await groupServicesOf(ctx.business.id);
  const now = new Date();
  const sessions = await sessionsFor(svcs, { from: now, to: new Date(now.getTime() + WEEKS * 7 * 86400000) }, tz);
  const recent = await sessionsFor(svcs, { from: new Date(now.getTime() - 7 * 86400000), to: new Date(now.getTime() + WEEKS * 7 * 86400000) }, tz);
  const [svcRows, leads] = await Promise.all([
    svcs.length ? db.select({ id: services.id, location: services.location }).from(services).where(eq(services.businessId, ctx.business.id)) : [],
    db.select({ serviceId: serviceMembers.serviceId, name: members.displayName }).from(serviceMembers).innerJoin(members, eq(members.id, serviceMembers.memberId)).where(eq(members.businessId, ctx.business.id)),
  ]);
  return {
    count: sessions.length,
    sessions: sessions.map((s) => {
      const svc = svcs.find((x) => x.id === s.serviceId)!;
      const remaining = s.capacity == null ? null : Math.max(0, s.capacity - s.booked);
      return {
        serviceId: s.serviceId,
        sessionId: s.id,
        serviceName: svc.name,
        serviceColor: svc.color,
        serviceActive: svc.isActive,
        recurring: s.virtual || !!svc.recurrence?.weekdays.length,
        location: svcRows.find((x) => x.id === s.serviceId)?.location ?? "",
        employeeNames: s.memberName ? [s.memberName] : leads.filter((l) => l.serviceId === s.serviceId).map((l) => l.name),
        date: dayOf(s.startsAt, tz),
        startTime: timeOf(s.startsAt, tz),
        endTime: timeOf(s.endsAt, tz),
        capacity: s.capacity,
        booked: s.booked,
        remaining,
        full: remaining === 0,
      };
    }),
    courses: await Promise.all(svcs.map((svc) => courseDto(ctx, svc, recent))),
  };
}

async function participants(r: ApiRequest) {
  const ctx = await needCtx("groupSessions.view");
  const svc = await course(ctx, r.params.serviceId!);
  const date = r.query.get("date")?.slice(0, 10);
  const startTime = r.query.get("startTime");
  if (!isDay(date) || !isTime(startTime)) return invalid("Séance invalide.");
  const startsAt = at(date, startTime, ctx.business.timezone);
  const [g] = await db.select().from(groupSessions).where(and(eq(groupSessions.serviceId, svc.id), eq(groupSessions.startsAt, startsAt)));
  const rows = g
    ? await db.select({ id: appointments.id, name: appointments.contactName, email: appointments.contactEmail, phone: appointments.contactPhone }).from(appointments).where(and(eq(appointments.groupSessionId, g.id), ne(appointments.status, "cancelled"))).orderBy(asc(appointments.createdAt))
    : [];
  return { serviceName: svc.name, capacity: g?.capacity ?? svc.capacity, count: rows.length, participants: rows.map((p) => ({ bookingId: p.id, fullName: p.name ?? "", email: p.email ?? "", phone: p.phone ?? "" })) };
}

async function addSession(r: ApiRequest) {
  const ctx = await needCtx("groupSessions.manage");
  const svc = await course(ctx, r.params.serviceId!);
  const b = r.body;
  if (!isDay(b.date) || !isTime(b.startTime) || !isTime(b.endTime)) return invalid("Date ou heures invalides.");
  // Une séance annulée à ce même horaire est simplement rétablie.
  const [cancelled] = await db.select({ id: groupSessions.id }).from(groupSessions).where(and(eq(groupSessions.serviceId, svc.id), eq(groupSessions.startsAt, at(b.date, b.startTime, ctx.business.timezone)), isNotNull(groupSessions.cancelledAt)));
  if (cancelled) {
    await restoreSession(cancelled.id);
    return { course: await courseDto(ctx, svc) };
  }
  const res = await createSessions(svc.id, undefined, formData({ date: b.date, start: b.startTime, end: b.endTime, memberId: "", capacity: "" }));
  if (res?.error) return invalid(res.fieldErrors ? (Object.values(res.fieldErrors)[0] ?? res.error) : res.error);
  return { course: await courseDto(ctx, svc) };
}

async function removeSession(r: ApiRequest) {
  const ctx = await needCtx("groupSessions.manage");
  const svc = await course(ctx, r.params.serviceId!);
  const id = r.params.index!;
  const virtual = parseVirtualSessionId(id);
  const ok = /^[0-9a-f-]{36}$/i.test(id) ? (await db.select({ id: groupSessions.id }).from(groupSessions).where(and(eq(groupSessions.id, id), eq(groupSessions.serviceId, svc.id)))).length > 0 : virtual?.serviceId === svc.id;
  if (!ok) return fail(404, "not_found", "Séance introuvable.");
  ensureOk(await cancelSession(id));
  return { course: await courseDto(ctx, svc) };
}

async function setRecurring(r: ApiRequest) {
  const ctx = await needCtx("groupSessions.manage");
  const svc = await course(ctx, r.params.serviceId!);
  const enabled = bool(r.body.enabled);
  const weekdays = enabled && Array.isArray(r.body.weekdays) ? (r.body.weekdays as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) : [];
  if (enabled && (!weekdays.length || !isTime(r.body.startTime))) return invalid("Choisissez au moins un jour et une heure.");
  ensureOk(await saveRecurrence(svc.id, { weekdays, startTime: enabled ? (r.body.startTime as string) : "" }));
  const [fresh] = await groupServicesOf(ctx.business.id, [svc.id]);
  return { course: await courseDto(ctx, fresh!) };
}

export const groupRoutes: Route[] = [
  { method: "GET", path: "/group-sessions", handler: list },
  { method: "GET", path: "/group-sessions/:serviceId/participants", handler: participants },
  { method: "POST", path: "/group-sessions/:serviceId/sessions", handler: addSession },
  { method: "DELETE", path: "/group-sessions/:serviceId/sessions/:index", handler: removeSession },
  { method: "PATCH", path: "/group-sessions/:serviceId/recurring", handler: setRecurring },
  {
    method: "PATCH",
    path: "/group-sessions/participants/:bookingId/remove",
    handler: async (r) => {
      const ctx = await needCtx("appointments.cancel");
      const id = r.params.bookingId!;
      if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found", "Inscription introuvable.");
      const [a] = await db.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.id, id), eq(appointments.businessId, ctx.business.id)));
      if (!a) return fail(404, "not_found", "Inscription introuvable.");
      ensureOk(await cancelAppointment(id));
      return { ok: true, id };
    },
  },
];


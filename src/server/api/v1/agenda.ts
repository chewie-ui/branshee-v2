import "server-only";
import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, format, startOfDay, startOfMonth } from "date-fns";
import { and, count, countDistinct, desc, eq, gte, isNotNull, lt, ne, sum } from "drizzle-orm";
import { db } from "@/db";
import { appointments, services } from "@/db/schema";
import { cancelAppointment, createAppointment, rescheduleAppointment, saveBlock, saveInternalNote, setNoShow } from "@/server/actions/appointments";
import { getAvailableSlots } from "@/server/availability";
import { bool, ensureOk, fail, formData, has, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { appContext, bookingById, isDay, isTime, loadBookings, needCtx } from "@/server/api/v1/shared";

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const dayStart = (day: string, tz: string) => new Date(new TZDate(`${day}T00:00:00`, tz).getTime());

async function dashboard(r: ApiRequest) {
  const ctx = await needCtx("appointments.view");
  const tz = ctx.business.timezone;
  const bid = ctx.business.id;
  const now = new TZDate(new Date(), tz);
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const month = startOfMonth(now);
  const nextMonth = addMonths(month, 1);
  const prevMonth = addMonths(month, -1);
  const individual = [eq(appointments.businessId, bid), eq(appointments.kind, "appointment")];
  const countIn = async (from: Date, to: Date, cancelled: boolean) =>
    (await db.select({ n: count() }).from(appointments).where(and(...individual, gte(appointments.startsAt, from), lt(appointments.startsAt, to), cancelled ? eq(appointments.status, "cancelled") : ne(appointments.status, "cancelled"))))[0]?.n ?? 0;
  const [todayCount, monthCount, prevCount, monthCanceled] = await Promise.all([countIn(today, tomorrow, false), countIn(month, nextMonth, false), countIn(prevMonth, month, false), countIn(month, nextMonth, true)]);
  const [clients] = await db.select({ n: countDistinct(appointments.customerId) }).from(appointments).where(and(...individual, isNotNull(appointments.customerId), ne(appointments.status, "cancelled"), gte(appointments.startsAt, addDays(today, -90))));
  const [revenue] = await db
    .select({ cents: sum(services.priceCents) })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(and(...individual, eq(appointments.status, "confirmed"), eq(appointments.noShow, false), gte(appointments.startsAt, month), lt(appointments.startsAt, nextMonth)));
  const todayBookings = await loadBookings([eq(appointments.businessId, bid), gte(appointments.startsAt, today), lt(appointments.startsAt, tomorrow), ne(appointments.status, "cancelled")], tz);
  const upcoming = await loadBookings([...individual, gte(appointments.startsAt, tomorrow), ne(appointments.status, "cancelled")], tz, { limit: 10 });
  const context = await appContext(r.auth!.userId);
  return {
    company: { id: bid, name: ctx.business.name, role: context?.activeCompany.role ?? null, isOwner: ctx.member.isOwner },
    stats: { todayCount, monthCount, monthDeltaPct: prevCount ? Math.round(((monthCount - prevCount) / prevCount) * 100) : monthCount ? 100 : 0, monthCanceled, activeClients: clients?.n ?? 0, monthRevenue: Number(revenue?.cents ?? 0) / 100 },
    todayBookings,
    upcoming,
  };
}

async function list(r: ApiRequest) {
  const ctx = await needCtx("appointments.view");
  const tz = ctx.business.timezone;
  const from = r.query.get("from");
  const to = r.query.get("to");
  const employee = r.query.get("employee");
  const where = [eq(appointments.businessId, ctx.business.id)];
  if (uuid(employee)) where.push(eq(appointments.memberId, employee!));
  if (isDay(from) && isDay(to)) {
    if (to < from) return invalid("Période invalide.");
    const end = format(addDays(new Date(`${to}T12:00:00Z`), 1), "yyyy-MM-dd");
    if ((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000 > 62) return invalid("Période trop longue (62 jours maximum).");
    const bookings = await loadBookings([...where, gte(appointments.startsAt, dayStart(from, tz)), lt(appointments.startsAt, dayStart(end, tz))], tz);
    return { from, to, count: bookings.length, bookings };
  }
  const date = isDay(r.query.get("date")) ? r.query.get("date")! : format(new TZDate(new Date(), tz), "yyyy-MM-dd");
  const next = format(addDays(new Date(`${date}T12:00:00Z`), 1), "yyyy-MM-dd");
  const bookings = await loadBookings([...where, gte(appointments.startsAt, dayStart(date, tz)), lt(appointments.startsAt, dayStart(next, tz))], tz);
  return { date, count: bookings.length, bookings };
}

async function slots(r: ApiRequest) {
  const ctx = await needCtx("appointments.manage");
  const date = r.query.get("date");
  if (!isDay(date)) return invalid("Date invalide.");
  const serviceId = uuid(r.query.get("serviceId")) ? r.query.get("serviceId")! : null;
  const memberId = uuid(r.query.get("employeeId")) ? r.query.get("employeeId")! : undefined;
  let duration = Math.round(Number(r.query.get("duration") ?? 0));
  if (serviceId && !duration) {
    const [s] = await db.select({ d: services.durationMin }).from(services).where(and(eq(services.id, serviceId), eq(services.businessId, ctx.business.id)));
    duration = s?.d ?? 30;
  }
  if (!duration) duration = 30;
  if (duration < 5 || duration > 720) return invalid("Durée invalide.");
  const res = await getAvailableSlots({ businessId: ctx.business.id, serviceId, memberId, days: [date], ignoreOnlineRules: true, ...(serviceId && !r.query.get("duration") ? {} : { durationMin: duration }) });
  const list = (res[date] ?? []).map((s) => s.time);
  return { date, slots: list, closed: list.length === 0, duration };
}

/** Le dernier RDV (ou blocage) créé par cette personne : les actions du site redirigent au lieu de renvoyer l'identifiant. */
async function lastCreated(businessId: string, userId: string, kind: "appointment" | "block") {
  const [a] = await db.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.businessId, businessId), eq(appointments.createdById, userId), eq(appointments.kind, kind))).orderBy(desc(appointments.createdAt)).limit(1);
  return a?.id ?? null;
}

const isRedirect = (e: unknown) => String((e as { digest?: string })?.digest ?? "").startsWith("NEXT_REDIRECT");

async function create(r: ApiRequest) {
  const ctx = await needCtx("appointments.manage");
  const b = r.body;
  if (!isDay(b.date) || !isTime(b.startTime)) return invalid("Date ou heure invalide.");
  const serviceId = uuid(b.serviceId) ? (b.serviceId as string) : "";
  let duration = Math.round(Number(b.duration ?? 0));
  if (!duration && serviceId) {
    const [s] = await db.select({ d: services.durationMin }).from(services).where(and(eq(services.id, serviceId), eq(services.businessId, ctx.business.id)));
    duration = s?.d ?? 30;
  }
  const email = str(b.email, 200).toLowerCase();
  if (!str(b.name, 60)) return invalid("Indiquez le prénom du client.", { field: "name" });
  const before = await lastCreated(ctx.business.id, ctx.user.id, "appointment");
  try {
    const res = await createAppointment(
      undefined,
      formData({
        serviceId,
        memberId: uuid(b.employeeId) ? (b.employeeId as string) : "",
        slots: JSON.stringify([{ date: b.date, time: b.startTime }]),
        durationMin: duration || 30,
        customerId: "",
        newFirstName: str(b.name, 60),
        newLastName: str(b.surname, 60),
        newEmail: email,
        newPhone: str(b.phone, 40),
        note: str(b.message, 1000),
        notify: true,
      }),
    );
    if (res?.error) {
      const msg = res.fieldErrors ? (Object.values(res.fieldErrors)[0] ?? res.error) : res.error;
      return fail(/occupé|déjà/.test(msg) ? 409 : 400, /occupé|déjà/.test(msg) ? "slot_taken" : "invalid", msg);
    }
  } catch (e) {
    if (!isRedirect(e)) throw e;
  }
  const id = await lastCreated(ctx.business.id, ctx.user.id, "appointment");
  if (!id || id === before) return fail(500, "server_error", "Rendez-vous non créé.");
  return { booking: await bookingById(ctx, id) };
}

async function block(r: ApiRequest) {
  const ctx = await needCtx("appointments.manage");
  const b = r.body;
  if (!isDay(b.date) || !isTime(b.startTime) || !isTime(b.endTime)) return invalid("Date ou heures invalides.");
  ensureOk(await saveBlock(null, { date: b.date, start: b.startTime, end: b.endTime, memberId: uuid(b.employeeId) ? (b.employeeId as string) : "", note: str(b.note, 200) }));
  const id = await lastCreated(ctx.business.id, ctx.user.id, "block");
  return { booking: await bookingById(ctx, id!) };
}

async function update(r: ApiRequest) {
  const ctx = await needCtx("appointments.manage");
  const id = r.params.id!;
  const current = await bookingById(ctx, id);
  const b = r.body;
  if (has(b, "adminNotes")) ensureOk(await saveInternalNote(id, str(b.adminNotes, 2000)));
  const moving = has(b, "date") || has(b, "startTime") || has(b, "employeeId") || has(b, "duration");
  if (moving) {
    const date = has(b, "date") ? b.date : current.date;
    const start = has(b, "startTime") ? b.startTime : current.startTime;
    if (!isDay(date) || !isTime(start)) return invalid("Date ou heure invalide.");
    if (current.isBlock) {
      const end = has(b, "endTime") && isTime(b.endTime) ? b.endTime : format(new Date(new Date(`2000-01-01T${start}:00Z`).getTime() + current.slotTime * 60000), "HH:mm");
      ensureOk(await saveBlock(id, { date, start, end, memberId: has(b, "employeeId") ? (uuid(b.employeeId) ? (b.employeeId as string) : "") : (current.employeeId ?? ""), note: has(b, "note") ? str(b.note, 200) : current.adminNotes }));
    } else {
      const res = await rescheduleAppointment(id, {
        date,
        start,
        durationMin: has(b, "duration") ? Number(b.duration) : current.slotTime,
        memberId: has(b, "employeeId") ? (uuid(b.employeeId) ? (b.employeeId as string) : "") : (current.employeeId ?? ""),
        message: str(b.message, 500),
        notify: has(b, "notify") ? bool(b.notify) : true,
      });
      if (!res.ok) return fail(/déjà/.test(res.error) ? 409 : 400, /déjà/.test(res.error) ? "slot_taken" : "invalid", res.error);
    }
  }
  return { booking: await bookingById(ctx, id) };
}

export const agendaRoutes: Route[] = [
  { method: "GET", path: "/dashboard", handler: dashboard },
  { method: "GET", path: "/bookings", handler: list },
  {
    method: "GET",
    path: "/bookings/upcoming",
    handler: async (r) => {
      const ctx = await needCtx("appointments.view");
      const limit = Math.min(50, Math.max(1, Number(r.query.get("limit") ?? 20) || 20));
      return { bookings: await loadBookings([eq(appointments.businessId, ctx.business.id), eq(appointments.kind, "appointment"), gte(appointments.startsAt, new Date()), ne(appointments.status, "cancelled")], ctx.business.timezone, { limit }) };
    },
  },
  { method: "GET", path: "/bookings/slots", handler: slots },
  { method: "GET", path: "/bookings/:id", handler: async (r) => ({ booking: await bookingById(await needCtx("appointments.view"), r.params.id!) }) },
  { method: "POST", path: "/bookings", handler: create },
  { method: "POST", path: "/bookings/block", handler: block },
  { method: "PATCH", path: "/bookings/:id", handler: update },
  {
    method: "PATCH",
    path: "/bookings/:id/cancel",
    handler: async (r) => {
      const ctx = await needCtx("appointments.cancel");
      await bookingById(ctx, r.params.id!);
      ensureOk(await cancelAppointment(r.params.id!));
      return { ok: true, id: r.params.id };
    },
  },
  {
    method: "PATCH",
    path: "/bookings/:id/no-show",
    handler: async (r) => {
      const ctx = await needCtx("appointments.manage");
      await bookingById(ctx, r.params.id!);
      const reason = r.body.reason === "valid" ? "justified" : r.body.reason === "invalid" ? "unjustified" : null;
      const res = await setNoShow(r.params.id!, reason !== null, reason);
      if (!res.ok) return fail(400, "invalid", res.error ?? "Action impossible.");
      return { booking: await bookingById(ctx, r.params.id!), ...(res.message ? { message: res.message } : {}), ...(res.error ? { warning: res.error } : {}) };
    },
  },
];


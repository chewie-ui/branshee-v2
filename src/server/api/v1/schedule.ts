import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { and, asc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bookingSettings, scheduleExceptions, weeklyHours } from "@/db/schema";
import { addException, deleteException, saveWeeklyHours } from "@/server/actions/schedule";
import { businessHas } from "@/server/plan";
import { bool, fail, invalid, type ApiRequest, type Route } from "@/server/api/http";
import { isDay, isTime, needCtx } from "@/server/api/v1/shared";
import type { AppContext } from "@/server/context";

const LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const hhmm = (t: string) => t.slice(0, 5);
type Range = { start: string; end: string };

/** Horaires affichés dans l'application : ceux de l'établissement, ou ceux du membre connecté en mode « horaires individuels ». */
async function target(ctx: AppContext) {
  const [s] = await db.select().from(bookingSettings).where(eq(bookingSettings.businessId, ctx.business.id));
  return { settings: s, memberId: s?.scheduleMode === "per_member" ? ctx.member.id : null };
}

async function week(businessId: string, memberId: string | null) {
  const rows = await db.select().from(weeklyHours).where(and(eq(weeklyHours.businessId, businessId), memberId ? eq(weeklyHours.memberId, memberId) : isNull(weeklyHours.memberId))).orderBy(asc(weeklyHours.startTime));
  const out: Record<string, Range[]> = {};
  for (const r of rows) (out[String(r.weekday)] ??= []).push({ start: hhmm(r.startTime), end: hhmm(r.endTime) });
  return out;
}

async function get() {
  const ctx = await needCtx();
  const { settings, memberId } = await target(ctx);
  const w = await week(ctx.business.id, memberId);
  const advanced = await businessHas(ctx.business.id, "advancedAvailability");
  return {
    days: ORDER.map((wd) => ({ weekdayIndex: wd, label: LABELS[wd]!, closed: !(w[String(wd)]?.length), ranges: w[String(wd)] ?? [] })),
    settings: { slotTime: settings?.slotIntervalMin ?? 30, slotMode: settings?.slotMode ?? "fixed", slotInterval: settings?.slotIntervalMin ?? 30, scheduleMode: settings?.scheduleMode ?? "shared" },
    planFeatures: { multipleRanges: true, buffer: advanced, slotDuration: advanced },
  };
}

async function updateDay(r: ApiRequest) {
  const ctx = await needCtx();
  const wd = Number(r.params.weekdayIndex);
  if (!Number.isInteger(wd) || wd < 0 || wd > 6) return invalid("Jour invalide.");
  const { memberId } = await target(ctx);
  const w = await week(ctx.business.id, memberId);
  const closed = bool(r.body.closed);
  const ranges = closed ? [] : Array.isArray(r.body.ranges) ? (r.body.ranges as Range[]).map((x) => ({ start: String(x?.start ?? ""), end: String(x?.end ?? "") })) : [];
  if (!closed && !ranges.length) return invalid("Ajoutez au moins une plage horaire, ou fermez ce jour.");
  if (ranges.some((x) => !isTime(x.start) || !isTime(x.end))) return invalid("Heure invalide (format HH:MM).");
  if (ranges.length) w[String(wd)] = ranges;
  else delete w[String(wd)];
  const res = await saveWeeklyHours(memberId, w);
  if (!res.ok) return fail(res.error.includes("droit") ? 403 : 400, res.error.includes("droit") ? "forbidden" : "invalid", res.error);
  return { day: { weekdayIndex: wd, closed: !ranges.length, ranges: [...ranges].sort((a, b) => a.start.localeCompare(b.start)) } };
}

/* ── Congés et fermetures : en v2 une ligne par jour et par personne ; l'application voit une entrée par jour avec la liste des personnes ── */

type Exc = typeof scheduleExceptions.$inferSelect;
function group(rows: Exc[]) {
  const map = new Map<string, Exc[]>();
  for (const e of rows) {
    const key = `${e.date}|${e.isClosed}|${JSON.stringify(e.hours)}|${e.reason ?? ""}|${e.createdAt.getTime()}`;
    (map.get(key) ?? map.set(key, []).get(key)!).push(e);
  }
  return [...map.values()].map((list) => {
    const e = list[0]!;
    const memberIds = list.map((x) => x.memberId).filter((x): x is string => !!x);
    return { id: list.map((x) => x.id).join(","), date: e.date, closed: e.isClosed, ranges: e.hours, employeeIds: memberIds, appliesToAll: list.some((x) => !x.memberId), reason: e.reason ?? "" };
  });
}

async function listTimeOff() {
  const ctx = await needCtx();
  const today = format(new TZDate(new Date(), ctx.business.timezone), "yyyy-MM-dd");
  const rows = await db.select().from(scheduleExceptions).where(and(eq(scheduleExceptions.businessId, ctx.business.id), gte(scheduleExceptions.date, today))).orderBy(asc(scheduleExceptions.date)).limit(500);
  return { timeOff: group(rows) };
}

async function addTimeOff(r: ApiRequest) {
  const ctx = await needCtx();
  const b = r.body;
  if (!isDay(b.date)) return invalid("Date invalide.");
  const closed = bool(b.closed);
  const ranges = Array.isArray(b.ranges) ? (b.ranges as Range[]).map((x) => ({ start: String(x?.start ?? ""), end: String(x?.end ?? "") })).filter((x) => isTime(x.start) && isTime(x.end)) : [];
  if (!closed && !ranges.length) return invalid("Indiquez les horaires spéciaux, ou bloquez la journée entière.");
  const memberIds = Array.isArray(b.employeeIds) ? (b.employeeIds as unknown[]).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)) : [];
  const res = await addException({ memberIds: memberIds.join(","), from: b.date, to: b.date, type: closed ? "closed" : "hours", start: ranges[0]?.start ?? "", end: ranges[0]?.end ?? "", reason: typeof b.reason === "string" ? b.reason.slice(0, 120) : "" });
  if (!res.ok) return fail(res.error.includes("droit") ? 403 : 400, res.error.includes("droit") ? "forbidden" : "invalid", res.error);
  const where = and(eq(scheduleExceptions.businessId, ctx.business.id), eq(scheduleExceptions.date, b.date), memberIds.length ? inArray(scheduleExceptions.memberId, memberIds) : isNull(scheduleExceptions.memberId));
  // Plusieurs plages horaires spéciales : complétées après coup (l'action du site n'en prend qu'une).
  if (!closed && ranges.length > 1) await db.update(scheduleExceptions).set({ hours: ranges }).where(where);
  const rows = await db.select().from(scheduleExceptions).where(where);
  return { timeOff: group(rows.map((x) => ({ ...x, createdAt: rows[0]!.createdAt })))[0] };
}

async function removeTimeOff(r: ApiRequest) {
  await needCtx();
  const ids = r.params.dateId!.split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  if (!ids.length) return fail(404, "not_found", "Introuvable.");
  for (const id of ids) {
    const res = await deleteException(id);
    if (!res.ok && res.error !== "Introuvable.") return fail(403, "forbidden", res.error);
  }
  return { ok: true, id: r.params.dateId };
}

export const scheduleRoutes: Route[] = [
  { method: "GET", path: "/schedule", handler: get },
  { method: "PATCH", path: "/schedule/:weekdayIndex", handler: updateDay },
  { method: "GET", path: "/timeoff", handler: listTimeOff },
  { method: "POST", path: "/timeoff", handler: addTimeOff },
  { method: "DELETE", path: "/timeoff/:dateId", handler: removeTimeOff },
];


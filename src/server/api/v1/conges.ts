import "server-only";
import { headers } from "next/headers";
import { LEAVE_KINDS, belgianHolidays, isLeaveKind } from "@/lib/leave";
import { addDays, isDay, todayIn } from "@/lib/planning";
import { cancelLeave, decideLeave, requestLeave, setAllowance, setAllowanceForAll } from "@/server/actions/leave";
import { fail, forbidden, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { leaveBalances, leaveMembers, leaveRights, listLeave } from "@/server/leave";
import { isLocked } from "@/server/plan";

/** API mobile de l'app Congés (Skydev) : demandes, validation, annulation, calendrier, soldes. */

async function needConges(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("conges")) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const ok = <T extends { ok: boolean }>(r: T) => {
  const e = r as { ok: boolean; error?: string };
  if (!e.ok) return invalid(e.error ?? "Action impossible.");
  return r as T & { message?: string };
};
const kinds = Object.entries(LEAVE_KINDS).map(([id, k]) => ({ id, label: k.label, counted: k.counted }));
const year = (q: string | null, today: string) => {
  const n = Number(q);
  return n >= 2000 && n <= 2100 ? n : Number(today.slice(0, 4));
};

async function overview() {
  const ctx = await needConges();
  const today = todayIn(ctx.business.timezone);
  const y = Number(today.slice(0, 4));
  const rights = leaveRights(ctx);
  const [members, all, balances] = await Promise.all([leaveMembers(ctx), listLeave(ctx), leaveBalances(ctx, y, today)]);
  return {
    today,
    year: y,
    me: ctx.member.id,
    canApprove: rights.approve,
    seeAll: rights.seeAll,
    kinds,
    members,
    pending: rights.approve ? all.filter((l) => l.status === "pending").sort((a, b) => a.start.localeCompare(b.start)) : [],
    upcoming: all.filter((l) => l.end >= today && (l.status === "approved" || (l.status === "pending" && !rights.approve))).sort((a, b) => a.start.localeCompare(b.start)),
    past: all.filter((l) => l.end < today || l.status === "refused").slice(0, 30),
    balance: balances.find((b) => b.memberId === ctx.member.id) ?? null,
  };
}

async function calendar(r: ApiRequest) {
  const ctx = await needConges();
  const today = todayIn(ctx.business.timezone);
  const q = r.query.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q) ? q : today.slice(0, 7);
  const first = `${month}-01`;
  const last = addDays(`${addDays(first, 32).slice(0, 7)}-01`, -1);
  const [members, leave] = await Promise.all([leaveMembers(ctx), listLeave(ctx, { from: first, to: last, statuses: ["approved", "pending"] })]);
  const holidays = [...belgianHolidays(Number(month.slice(0, 4)))].filter(([d]) => d.startsWith(month)).map(([date, name]) => ({ date, name }));
  return { month, first, last, today, members, leave, holidays };
}

async function balances(r: ApiRequest) {
  const ctx = await needConges();
  if (!leaveRights(ctx).approve) return forbidden();
  const today = todayIn(ctx.business.timezone);
  const y = year(r.query.get("year"), today);
  const [members, list] = await Promise.all([leaveMembers(ctx), leaveBalances(ctx, y, today)]);
  return { year: y, members, balances: list };
}

export const congesRoutes: Route[] = [
  { method: "GET", path: "/leave", handler: overview },
  { method: "GET", path: "/leave/calendar", handler: calendar },
  { method: "GET", path: "/leave/balances", handler: balances },
  {
    method: "POST",
    path: "/leave",
    handler: async (r) => {
      await needConges();
      const b = r.body;
      const kind = str(b.kind, 20);
      const start = str(b.start, 10);
      const end = str(b.end, 10) || start;
      if (!isLeaveKind(kind)) return invalid("Type d'absence invalide.");
      if (!isDay(start) || !isDay(end)) return invalid("Dates invalides.");
      const period = b.period === "am" ? "am" : b.period === "pm" ? "pm" : "full";
      return { ok: true, message: ok(await requestLeave({ memberId: uuid(b.memberId) ? (b.memberId as string) : undefined, kind, start, end, period, note: str(b.note, 500) })).message ?? null };
    },
  },
  {
    method: "POST",
    path: "/leave/:id/decide",
    handler: async (r) => {
      await needConges();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Demande introuvable.");
      return { ok: true, message: ok(await decideLeave(r.params.id!, r.body.approve === true, str(r.body.note, 500))).message ?? null };
    },
  },
  {
    method: "POST",
    path: "/leave/:id/cancel",
    handler: async (r) => {
      await needConges();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Absence introuvable.");
      return { ok: true, message: ok(await cancelLeave(r.params.id!)).message ?? null };
    },
  },
  {
    method: "PATCH",
    path: "/leave/allowances",
    handler: async (r) => {
      const ctx = await needConges();
      const y = year(String(r.body.year ?? ""), todayIn(ctx.business.timezone));
      if (r.body.all === true) return { ok: true, message: ok(await setAllowanceForAll(y, Number(r.body.days))).message ?? null };
      if (!uuid(r.body.memberId)) return invalid("Membre introuvable.");
      const days = r.body.days === null || r.body.days === "" ? null : Number(r.body.days);
      return { ok: true, message: ok(await setAllowance(r.body.memberId as string, y, days)).message ?? null };
    },
  },
];

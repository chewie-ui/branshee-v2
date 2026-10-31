import "server-only";
import { headers } from "next/headers";
import { GET as exportWeek } from "@/app/app/planning/export/route";
import { isDay, isoWeek, mondayOf, todayIn, weekRangeLabel } from "@/lib/planning";
import { clearWeek, copyPreviousWeek, deleteShift, planningFeedToken, regenerateFeedToken, saveShift } from "@/server/actions/planning";
import { fail, forbidden, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { isLocked } from "@/server/plan";
import { planningRights, weekPlanning } from "@/server/planning";

/** API mobile de l'app Planning (Skydev) : semaine, horaires, recopier/vider, export Excel, lien d'agenda. */

async function needPlanning(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("horaires")) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const ok = <T extends { ok: boolean }>(r: T) => {
  const e = r as { ok: boolean; error?: string };
  if (!e.ok) return invalid(e.error ?? "Action impossible.");
  return r as T & { message?: string; token?: string };
};
const origin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");
const monday = (ctx: AppContext, q: unknown) => mondayOf(isDay(q) ? (q as string) : todayIn(ctx.business.timezone));

async function week(r: ApiRequest) {
  const ctx = await needPlanning();
  const today = todayIn(ctx.business.timezone);
  const m = monday(ctx, r.query.get("week"));
  const [data, rights] = [await weekPlanning(ctx, m), planningRights(ctx)];
  return { monday: m, today, week: isoWeek(m), label: weekRangeLabel(m), canManage: rights.manage, seeAll: rights.seeAll, ...data };
}

async function save(r: ApiRequest, id?: string) {
  await needPlanning();
  if (id !== undefined && !uuid(id)) return fail(404, "not_found", "Horaire introuvable.");
  const b = r.body;
  const ids = (k: string) => (Array.isArray(b[k]) ? (b[k] as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 200) : []);
  const res = ok(
    await saveShift({
      id,
      memberIds: ids("memberIds"),
      days: ids("days").slice(0, 31),
      start: str(b.start, 5),
      end: str(b.end, 5),
      breakMinutes: Math.max(0, Math.min(600, Math.round(Number(b.breakMinutes) || 0))),
      label: str(b.label, 60),
      note: str(b.note, 300),
    }),
  );
  return { ok: true, message: res.message ?? null };
}

export const planningRoutes: Route[] = [
  { method: "GET", path: "/planning", handler: week },
  { method: "POST", path: "/planning/shifts", handler: (r) => save(r) },
  { method: "PATCH", path: "/planning/shifts/:id", handler: (r) => save(r, r.params.id!) },
  {
    method: "DELETE",
    path: "/planning/shifts/:id",
    handler: async (r) => {
      await needPlanning();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Horaire introuvable.");
      return { ok: true, message: ok(await deleteShift(r.params.id!)).message ?? null };
    },
  },
  {
    method: "POST",
    path: "/planning/copy-previous",
    handler: async (r) => {
      const ctx = await needPlanning();
      return { ok: true, message: ok(await copyPreviousWeek(monday(ctx, r.body.monday))).message ?? null };
    },
  },
  {
    method: "POST",
    path: "/planning/clear",
    handler: async (r) => {
      const ctx = await needPlanning();
      return { ok: true, message: ok(await clearWeek(monday(ctx, r.body.monday))).message ?? null };
    },
  },
  {
    method: "GET",
    path: "/planning/export",
    handler: async (r) => {
      const ctx = await needPlanning();
      return exportWeek(new Request(`${origin()}/app/planning/export?semaine=${monday(ctx, r.query.get("week"))}`));
    },
  },
  {
    method: "GET",
    path: "/planning/feed",
    handler: async () => {
      await needPlanning();
      const res = ok(await planningFeedToken());
      return { url: `${origin()}/ical/horaires/${res.token}` };
    },
  },
  {
    method: "POST",
    path: "/planning/feed",
    handler: async () => {
      await needPlanning();
      const res = ok(await regenerateFeedToken());
      return { url: `${origin()}/ical/horaires/${res.token}`, message: res.message ?? null };
    },
  },
];

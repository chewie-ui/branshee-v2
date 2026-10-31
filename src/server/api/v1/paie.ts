import "server-only";
import { headers } from "next/headers";
import { GET as exportMonth } from "@/app/app/paie/export/route";
import { isMonth } from "@/lib/payroll";
import { todayIn } from "@/lib/planning";
import { savePayrollEntry, savePayrollProfile, setPayrollClosed } from "@/server/actions/payroll";
import { fail, forbidden, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { isLocked } from "@/server/plan";
import { payrollMonth, payrollRights } from "@/server/payroll";

/** API mobile de l'app Paie (Skydev) : prestations du mois, contrats, ajustements, validation, export. */

async function needPaie(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("paie") || !payrollRights(ctx).manage) return forbidden();
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
const origin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");
const monthOf = (ctx: AppContext, q: unknown) => (isMonth(q) ? q : todayIn(ctx.business.timezone).slice(0, 7));
const num = (v: unknown) => Number(String(v ?? "").replace(",", "."));

async function month(r: ApiRequest) {
  const ctx = await needPaie();
  const m = monthOf(ctx, r.query.get("month"));
  const data = await payrollMonth(ctx.business.id, m);
  return { month: m, rows: data.rows, closedAt: data.closedAt ? new Date(data.closedAt).toISOString() : null };
}

export const paieRoutes: Route[] = [
  { method: "GET", path: "/payroll", handler: month },
  {
    method: "GET",
    path: "/payroll/export",
    handler: async (r) => {
      const ctx = await needPaie();
      return exportMonth(new Request(`${origin()}/app/paie/export?mois=${monthOf(ctx, r.query.get("month"))}`));
    },
  },
  {
    method: "PATCH",
    path: "/payroll/profiles/:memberId",
    handler: async (r) => {
      await needPaie();
      if (!uuid(r.params.memberId)) return fail(404, "not_found", "Membre introuvable.");
      const b = r.body;
      return {
        ok: true,
        message: ok(await savePayrollProfile({ memberId: r.params.memberId!, weeklyHours: num(b.weeklyHours), payType: b.payType === "monthly" ? "monthly" : "hourly", rate: num(b.rate), mealVouchers: b.mealVouchers === true, externalId: str(b.externalId, 40) })).message ?? null,
      };
    },
  },
  {
    method: "PATCH",
    path: "/payroll/entries/:memberId",
    handler: async (r) => {
      const ctx = await needPaie();
      if (!uuid(r.params.memberId)) return fail(404, "not_found", "Membre introuvable.");
      const b = r.body;
      return {
        ok: true,
        message: ok(await savePayrollEntry({ memberId: r.params.memberId!, month: monthOf(ctx, b.month), adjustMinutes: Math.round(num(b.adjustMinutes) || 0), bonus: num(b.bonus) || 0, km: Math.round(num(b.km) || 0), note: str(b.note, 300) })).message ?? null,
      };
    },
  },
  {
    method: "POST",
    path: "/payroll/close",
    handler: async (r) => {
      const ctx = await needPaie();
      return { ok: true, message: ok(await setPayrollClosed(monthOf(ctx, r.body.month), r.body.closed !== false)).message ?? null };
    },
  },
];

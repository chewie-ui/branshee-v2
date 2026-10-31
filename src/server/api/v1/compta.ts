import "server-only";
import { GET as accountingCsv } from "@/app/app/compta/export/route";
import { FRANCHISE_THRESHOLD, GRID, parsePeriod, periodKey, periodRange, vatBalance, type Period } from "@/lib/accounting";
import { todayIn } from "@/lib/planning";
import { fail, forbidden, type ApiRequest, type Route } from "@/server/api/http";
import { accountingFor, monthlySeries, receivables } from "@/server/accounting";
import { currentContext, type AppContext } from "@/server/context";
import { getSellerSettings } from "@/server/invoicing";

/** API mobile de l'app Comptabilité (Skydev) : mêmes chiffres que /app/compta (lecture seule) et export CSV. */

async function needCompta(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("compta") || !ctx.can("invoices.view")) return forbidden();
  return ctx;
}

async function overview(r: ApiRequest) {
  const ctx = await needCompta();
  const tz = ctx.business.timezone || "Europe/Brussels";
  const today = todayIn(tz);
  const period = parsePeriod(r.query.get("p") ?? undefined, today);
  const range = periodRange(period);
  const regime = (await getSellerSettings(ctx.business.id)).vatRegime;
  const year = Number(today.slice(0, 4));
  const [a, rec, series, ytd] = await Promise.all([
    accountingFor(ctx.business.id, range.from, range.to, regime, tz),
    receivables(ctx.business.id, today),
    monthlySeries(ctx.business.id, today, regime, tz),
    regime === "franchise" ? accountingFor(ctx.business.id, `${year}-01-01`, `${year}-12-31`, regime, tz) : Promise.resolve(null),
  ]);
  const q = Math.ceil(Number(today.slice(5, 7)) / 3);
  const choices: [string, Period][] = [
    [`T${q} ${year}`, { kind: "quarter", year, index: q }],
    q > 1 ? [`T${q - 1} ${year}`, { kind: "quarter", year, index: q - 1 }] : [`T4 ${year - 1}`, { kind: "quarter", year: year - 1, index: 4 }],
    ["Ce mois-ci", { kind: "month", year, index: Number(today.slice(5, 7)) }],
    [String(year), { kind: "year", year, index: 1 }],
    [String(year - 1), { kind: "year", year: year - 1, index: 1 }],
  ];
  const balance = vatBalance(a.vatDue, a.expenses.vat);
  return {
    today,
    period: periodKey(period),
    label: range.label,
    choices: choices.map(([label, p]) => ({ label, key: periodKey(p) })),
    regime,
    salesHt: a.salesHt,
    invoices: a.invoices,
    pos: a.pos,
    shop: a.shop,
    expenses: { count: a.expenses.count, ht: a.expenses.ht, vat: a.expenses.vat, byCategory: a.expenses.byCategory.map(([category, ht]) => ({ category, ht })) },
    result: a.salesHt - a.expenses.ht,
    receivables: { total: rec.total, overdue: rec.overdue, rows: rec.rows.slice(0, 30).map((x) => ({ id: x.id, number: x.number, client: String(x.client?.name ?? ""), ttc: x.ttc, due: x.due })) },
    vat:
      regime === "assujetti"
        ? { sales: a.sales.map((s) => ({ grid: GRID[s.rate] ?? "—", rate: s.rate, base: s.base })), credits: a.invoices.credits, due: a.vatDue, deductible: a.expenses.vat, balance }
        : null,
    franchise: regime === "franchise" ? { year, salesHt: ytd?.salesHt ?? 0, threshold: FRANCHISE_THRESHOLD } : null,
    series,
  };
}

export const comptaRoutes: Route[] = [
  { method: "GET", path: "/accounting", handler: overview },
  {
    method: "GET",
    path: "/accounting/export",
    handler: async (r) => {
      await needCompta();
      return accountingCsv(new Request(`http://local/?p=${encodeURIComponent(r.query.get("p") ?? "")}`));
    },
  },
];

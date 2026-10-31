import "server-only";
import { headers } from "next/headers";
import { todayIn } from "@/lib/planning";
import { addActivity, deleteDeal, linkDealCustomer, moveDeal, quoteFromDeal, saveDeal } from "@/server/actions/sales";
import { deleteProspect, logCall, reopenProspect, saveProspect, saveScript } from "@/server/actions/prospects";
import { fail, forbidden, has, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { isLocked } from "@/server/plan";
import { callQueueOf, listProspects, prospectCounts, prospectHistory, prospectScript, prospectStats, upcomingCallbacks } from "@/server/prospects";
import { dealDetailFor, listDeals, salesMembers, salesRights } from "@/server/sales";

/** API mobile de l'app Ventes (Skydev) : pistes (tunnel), historique, relances, résultats, prospection et appels. */

async function needSales(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("ventes")) return forbidden();
  if (!salesRights(ctx).view) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const ok = <T extends { ok: boolean }>(r: T) => {
  const e = r as { ok: boolean; error?: string };
  if (!e.ok) return invalid(e.error ?? "Action impossible.");
  return r as Extract<T, { ok: true }>;
};
const idOr404 = (r: ApiRequest, what: string) => (uuid(r.params.id) ? r.params.id! : fail(404, "not_found", what));

function dealInput(b: Record<string, unknown>, id?: string) {
  return {
    id,
    title: str(b.title, 120),
    contactName: str(b.contactName, 120),
    companyName: str(b.companyName, 120),
    email: str(b.email, 200),
    phone: str(b.phone, 40),
    value: str(b.value, 20) || "0",
    source: str(b.source, 60),
    ownerMemberId: uuid(b.ownerMemberId) ? (b.ownerMemberId as string) : "",
    expectedClose: str(b.expectedClose, 10),
    nextActionDate: str(b.nextActionDate, 10),
    nextAction: str(b.nextAction, 200),
    stage: str(b.stage, 20) || undefined,
  };
}

function prospectInput(b: Record<string, unknown>, id?: string) {
  return { id, name: str(b.name, 120), company: str(b.company, 120), phone: str(b.phone, 40), email: str(b.email, 200), city: str(b.city, 80), trade: str(b.trade, 80), note: str(b.note, 2000) };
}

export const ventesRoutes: Route[] = [
  {
    method: "GET",
    path: "/deals",
    handler: async () => {
      const ctx = await needSales();
      const [deals, team] = await Promise.all([listDeals(ctx.business.id), salesMembers(ctx.business.id)]);
      return { today: todayIn(ctx.business.timezone || "Europe/Brussels"), me: ctx.member.id, canManage: salesRights(ctx).manage, canQuote: ctx.can("invoices.manage"), deals, team };
    },
  },
  {
    method: "GET",
    path: "/deals/:id",
    handler: async (r) => {
      const ctx = await needSales();
      const id = idOr404(r, "Piste introuvable.");
      const deal = (await listDeals(ctx.business.id)).find((d) => d.id === id);
      const detail = await dealDetailFor(ctx.business.id, id, ctx.can("invoices.view"));
      if (!deal || !detail) return fail(404, "not_found", "Piste introuvable.");
      return { deal, ...detail, canManage: salesRights(ctx).manage, canQuote: ctx.can("invoices.manage") };
    },
  },
  { method: "POST", path: "/deals", handler: async (r) => { await needSales(); const res = ok(await saveDeal(dealInput(r.body))); return { ok: true, id: res.id ?? null }; } },
  { method: "PATCH", path: "/deals/:id", handler: async (r) => { await needSales(); ok(await saveDeal(dealInput(r.body, idOr404(r, "Piste introuvable.")))); return { ok: true }; } },
  { method: "DELETE", path: "/deals/:id", handler: async (r) => { await needSales(); ok(await deleteDeal(idOr404(r, "Piste introuvable."))); return { ok: true }; } },
  {
    method: "POST",
    path: "/deals/:id/stage",
    handler: async (r) => {
      await needSales();
      const res = ok(await moveDeal(idOr404(r, "Piste introuvable."), str(r.body.stage, 20), str(r.body.lostReason, 200)));
      return { ok: true, message: res.message ?? null };
    },
  },
  {
    method: "POST",
    path: "/deals/:id/activities",
    handler: async (r) => {
      await needSales();
      const b = r.body;
      ok(await addActivity({ dealId: idOr404(r, "Piste introuvable."), kind: str(b.kind, 20), body: str(b.body, 2000), ...(has(b, "nextActionDate") ? { nextActionDate: str(b.nextActionDate, 10), nextAction: str(b.nextAction, 200) } : {}) }));
      return { ok: true };
    },
  },
  { method: "POST", path: "/deals/:id/customer", handler: async (r) => { await needSales(); const res = ok(await linkDealCustomer(idOr404(r, "Piste introuvable."))); return { ok: true, message: res.message ?? null, customerId: res.url?.split("/").pop() ?? null }; } },
  {
    method: "POST",
    path: "/deals/:id/quote",
    handler: async (r) => {
      await needSales();
      const res = ok(await quoteFromDeal(idOr404(r, "Piste introuvable.")));
      const m = res.url?.match(/\/app\/factures\/([0-9a-f-]{36})/);
      return { ok: true, documentId: m?.[1] ?? null, url: res.url ?? null };
    },
  },

  {
    method: "GET",
    path: "/prospects",
    handler: async (r) => {
      const ctx = await needSales();
      const [rows, counts] = await Promise.all([listProspects(ctx.business.id, { status: r.query.get("status") ?? undefined, q: str(r.query.get("q"), 100) || undefined }), prospectCounts(ctx.business.id)]);
      return { prospects: rows, counts, canManage: salesRights(ctx).manage };
    },
  },
  {
    method: "GET",
    path: "/prospects/queue",
    handler: async () => {
      const ctx = await needSales();
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const [queue, callbacks, script, stats] = await Promise.all([callQueueOf(ctx.business.id), upcomingCallbacks(ctx.business.id), prospectScript(ctx.business.id), prospectStats(ctx.business.id, since)]);
      return { queue, callbacks, script, stats, canManage: salesRights(ctx).manage };
    },
  },
  {
    method: "GET",
    path: "/prospects/stats",
    handler: async (r) => {
      const ctx = await needSales();
      const days = Math.min(365, Math.max(1, Number(r.query.get("days")) || 30));
      return { days, stats: await prospectStats(ctx.business.id, new Date(Date.now() - days * 86400_000)) };
    },
  },
  {
    method: "GET",
    path: "/prospects/:id/history",
    handler: async (r) => {
      const ctx = await needSales();
      const rows = await prospectHistory(ctx.business.id, idOr404(r, "Prospect introuvable."));
      return { calls: rows.map((c) => ({ ...c, at: c.at.toISOString() })) };
    },
  },
  { method: "POST", path: "/prospects", handler: async (r) => { await needSales(); const res = ok(await saveProspect(prospectInput(r.body))); return { ok: true, id: res.id ?? null }; } },
  { method: "PATCH", path: "/prospects/:id", handler: async (r) => { await needSales(); ok(await saveProspect(prospectInput(r.body, idOr404(r, "Prospect introuvable.")))); return { ok: true }; } },
  { method: "DELETE", path: "/prospects/:id", handler: async (r) => { await needSales(); ok(await deleteProspect(idOr404(r, "Prospect introuvable."))); return { ok: true }; } },
  { method: "POST", path: "/prospects/:id/reopen", handler: async (r) => { await needSales(); ok(await reopenProspect(idOr404(r, "Prospect introuvable."))); return { ok: true }; } },
  {
    method: "POST",
    path: "/prospects/:id/call",
    handler: async (r) => {
      await needSales();
      const b = r.body;
      const res = ok(await logCall({ id: idOr404(r, "Prospect introuvable."), outcome: str(b.outcome, 20), note: str(b.note, 2000), callbackAt: str(b.callbackAt, 40), reason: str(b.reason, 120) }));
      return { ok: true, message: res.message ?? null, dealId: res.dealId ?? null };
    },
  },
  { method: "PUT", path: "/prospects/script", handler: async (r) => { await needSales(); ok(await saveScript(str(r.body.body, 8000))); return { ok: true }; } },
];

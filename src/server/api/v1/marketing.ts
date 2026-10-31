import "server-only";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { campaignRecipients, campaigns } from "@/db/schema";
import { countAudience, deleteCampaign, saveCampaign, sendCampaign, stopCampaign, testCampaign } from "@/server/actions/marketing";
import { fail, forbidden, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { audienceCount, campaignsOf, dailyCap, marketingRights } from "@/server/marketing";
import { isLocked } from "@/server/plan";

/** API mobile de l'app Marketing (Skydev) : campagnes email, audience, test, envoi, arrêt. */

async function needMarketing(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("marketing") || !marketingRights(ctx).manage) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
type Res = { ok: boolean; error?: string; message?: string; id?: string; count?: number };
const ok = (r: Res) => (r.ok ? r : invalid(r.error ?? "Action impossible."));
const audienceOf = (v: unknown) => {
  const a = (v ?? {}) as { type?: unknown; days?: unknown };
  const type = a.type === "recent" ? "recent" : a.type === "inactive" ? "inactive" : "all";
  const days = Math.min(1095, Math.max(7, Math.round(Number(a.days) || 180)));
  return { type, days } as const;
};

async function list() {
  const ctx = await needMarketing();
  const [rows, reach, cap] = await Promise.all([campaignsOf(ctx.business.id), audienceCount(ctx.business.id, { type: "all", days: 30 }), dailyCap(ctx.business.id)]);
  return {
    reach,
    dailyCap: cap,
    campaigns: rows.map(({ c, sent, unsub }) => ({ id: c.id, subject: c.subject, status: c.status, recipients: c.recipients, sent, unsub, date: (c.sentAt ?? c.queuedAt ?? c.createdAt).toISOString() })),
  };
}

async function detail(r: ApiRequest) {
  const ctx = await needMarketing();
  if (!uuid(r.params.id)) return fail(404, "not_found", "Campagne introuvable.");
  const [c] = await db.select().from(campaigns).where(and(eq(campaigns.id, r.params.id!), eq(campaigns.businessId, ctx.business.id)));
  if (!c) return fail(404, "not_found", "Campagne introuvable.");
  const [s] = await db
    .select({ sent: sql<number>`count(*) filter (where status = 'sent')::int`, pending: sql<number>`count(*) filter (where status = 'pending')::int`, failed: sql<number>`count(*) filter (where status = 'failed')::int`, unsub: sql<number>`count(unsubscribed_at)::int` })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, c.id));
  return {
    campaign: { id: c.id, subject: c.subject, body: c.body, audience: c.audience, status: c.status, recipients: c.recipients },
    stats: c.status === "draft" ? null : (s ?? { sent: 0, pending: 0, failed: 0, unsub: 0 }),
    count: c.status === "draft" ? await audienceCount(ctx.business.id, c.audience) : c.recipients,
  };
}

/** Enregistre le brouillon (création ou modification) et renvoie son id. */
async function save(r: ApiRequest, id?: string) {
  await needMarketing();
  const res = ok(await saveCampaign({ id: id && uuid(id) ? id : undefined, subject: str(r.body.subject, 120), body: str(r.body.body, 5000), audience: audienceOf(r.body.audience) }));
  return { ok: true, id: res.id ?? id ?? null, message: res.message ?? null };
}

const action = (fn: (id: string) => Promise<Res>) => async (r: ApiRequest) => {
  await needMarketing();
  if (!uuid(r.params.id)) return fail(404, "not_found", "Campagne introuvable.");
  const res = ok(await fn(r.params.id!));
  return { ok: true, message: res.message ?? null };
};

export const marketingRoutes: Route[] = [
  { method: "GET", path: "/marketing/campaigns", handler: list },
  {
    method: "POST",
    path: "/marketing/audience",
    handler: async (r) => {
      await needMarketing();
      return { count: ok(await countAudience(audienceOf(r.body.audience ?? r.body))).count ?? 0 };
    },
  },
  { method: "POST", path: "/marketing/campaigns", handler: (r) => save(r) },
  { method: "GET", path: "/marketing/campaigns/:id", handler: detail },
  { method: "PATCH", path: "/marketing/campaigns/:id", handler: (r) => save(r, r.params.id) },
  { method: "DELETE", path: "/marketing/campaigns/:id", handler: action(deleteCampaign) },
  { method: "POST", path: "/marketing/campaigns/:id/test", handler: action(testCampaign) },
  { method: "POST", path: "/marketing/campaigns/:id/send", handler: action(sendCampaign) },
  { method: "POST", path: "/marketing/campaigns/:id/stop", handler: action(stopCampaign) },
];

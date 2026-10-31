import "server-only";
import { headers } from "next/headers";
import { answerCustomRequest, submitCustomRequest } from "@/server/actions/custom-work";
import { fail, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { featuresOf, requestsOf } from "@/server/custom-work";
import { APPS } from "@/lib/apps";
import { CUSTOM_FEATURES } from "@/lib/custom-work";
import { isLocked } from "@/server/plan";

/** API mobile de l'app Sur mesure (Skydev) : demandes de modifs ou d'outils, prix proposé, accepter / refuser. */

async function needSurMesure(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

type Res = { ok: boolean; error?: string; message?: string; id?: string };
const ok = (r: Res) => (r.ok ? { ok: true, message: r.message ?? null, id: r.id ?? null } : invalid(r.error ?? "Action impossible."));

async function overview() {
  const ctx = await needSurMesure();
  const manager = ctx.member.isOwner || ctx.can("settings.manage");
  const [reqs, feats] = manager ? await Promise.all([requestsOf(ctx.business.id), featuresOf(ctx.business.id)]) : [[], []];
  const names = new Map(APPS.map((a) => [a.id as string, a.name] as const));
  return {
    canRequest: manager,
    apps: APPS.filter((a) => a.billing === "included" && a.status === "active").map((a) => ({ id: a.id, name: a.name })),
    features: feats.map((x) => ({ label: CUSTOM_FEATURES[x.key]?.label ?? x.key, monthly: x.monthlyCents })),
    requests: reqs.map((r) => ({ id: r.id, title: r.title, description: r.description, app: r.appId ? (names.get(r.appId) ?? null) : null, status: r.status, setupCents: r.setupCents, monthlyCents: r.monthlyCents, reply: r.reply, createdAt: r.createdAt.toISOString() })),
  };
}

export const surMesureRoutes: Route[] = [
  { method: "GET", path: "/custom-requests", handler: overview },
  {
    method: "POST",
    path: "/custom-requests",
    handler: async (r: ApiRequest) => {
      await needSurMesure();
      return ok(await submitCustomRequest({ appId: str(r.body.appId, 40), title: str(r.body.title, 120), description: str(r.body.description, 5000) }));
    },
  },
  {
    method: "POST",
    path: "/custom-requests/:id/:action",
    handler: async (r: ApiRequest) => {
      await needSurMesure();
      const a = r.params.action;
      if (a !== "accept" && a !== "decline" && a !== "cancel") return fail(404, "not_found", "Action inconnue.");
      if (!/^[0-9a-f-]{36}$/i.test(r.params.id ?? "")) return fail(404, "not_found", "Demande introuvable.");
      return ok(await answerCustomRequest(r.params.id!, a));
    },
  },
];

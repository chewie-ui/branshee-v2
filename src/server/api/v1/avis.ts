import "server-only";
import { headers } from "next/headers";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { regenerateReviewQr, saveReviewSettings, sendReviewRequest } from "@/server/actions/google-reviews";
import { bool, fail, forbidden, has, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { privateFeedback, recentRequests, reviewOrigin, reviewRights, reviewSettingsOf, reviewStats } from "@/server/google-reviews";
import { DEFAULT_MESSAGE } from "@/lib/google-reviews";
import { isLocked } from "@/server/plan";

/** API mobile de l'app Avis Google (Skydev) : chiffres, demandes, envoi, remarques privées, réglages, QR code. */

async function needAvis(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("avis")) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

type Res = { ok: boolean; error?: string; message?: string };
const ok = (r: Res) => (r.ok ? { ok: true, message: r.message ?? null } : invalid(r.error ?? "Action impossible."));
const iso = (d: Date | null) => d?.toISOString() ?? null;

async function overview() {
  const ctx = await needAvis();
  const rights = reviewRights(ctx);
  const [s, stats, recent] = await Promise.all([reviewSettingsOf(ctx.business.id), reviewStats(ctx.business.id), ctx.can("customers.view") ? recentRequests(ctx.business.id) : Promise.resolve([])]);
  return {
    rights: { ...rights, feedback: ctx.can("customers.view") },
    hasGoogleUrl: !!s.googleUrl,
    autoSend: s.autoSend,
    delayHours: s.delayHours,
    minDaysBetween: s.minDaysBetween,
    qrUrl: `${reviewOrigin()}/avis/q/${s.qrToken}`,
    posterUrl: `${reviewOrigin()}/imprimer/avis`,
    stats,
    requests: recent.map((r) => ({
      id: r.id,
      name: r.name ?? r.email,
      afterBooking: !!r.appointmentId,
      createdAt: iso(r.createdAt),
      status: r.googleClickedAt ? "google" : r.feedbackAt ? "feedback" : r.openedAt ? "opened" : "sent",
    })),
  };
}

async function clients() {
  const ctx = await needAvis();
  if (!reviewRights(ctx).send) return forbidden();
  const rows = await db.select({ id: customers.id, name: customers.fullName, email: customers.email }).from(customers).where(and(eq(customers.businessId, ctx.business.id), isNotNull(customers.email))).orderBy(asc(customers.fullName)).limit(3000);
  return { clients: rows };
}

async function feedback() {
  const ctx = await needAvis();
  if (!ctx.can("customers.view")) return forbidden();
  const rows = await privateFeedback(ctx.business.id);
  return { feedback: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, rating: r.feedbackRating ?? 0, text: r.feedback ?? "", date: iso(r.feedbackAt) })) };
}

async function settings() {
  const ctx = await needAvis();
  if (!reviewRights(ctx).settings) return forbidden();
  const s = await reviewSettingsOf(ctx.business.id);
  return { settings: { googleUrl: s.googleUrl ?? "", autoSend: s.autoSend, delayHours: s.delayHours, minDaysBetween: s.minDaysBetween, message: s.message ?? "" }, defaultMessage: DEFAULT_MESSAGE };
}

async function saveSettings(r: ApiRequest) {
  const ctx = await needAvis();
  const s = await reviewSettingsOf(ctx.business.id);
  const b = r.body;
  ok(
    await saveReviewSettings({
      googleUrl: has(b, "googleUrl") ? str(b.googleUrl, 500) : (s.googleUrl ?? ""),
      autoSend: has(b, "autoSend") ? bool(b.autoSend) : s.autoSend,
      delayHours: has(b, "delayHours") ? Math.round(Number(b.delayHours)) || 24 : s.delayHours,
      minDaysBetween: has(b, "minDaysBetween") ? Math.round(Number(b.minDaysBetween)) || 180 : s.minDaysBetween,
      message: has(b, "message") ? str(b.message, 500) : (s.message ?? ""),
    }),
  );
  return settings();
}

export const avisRoutes: Route[] = [
  { method: "GET", path: "/reviews", handler: overview },
  { method: "GET", path: "/reviews/clients", handler: clients },
  { method: "GET", path: "/reviews/feedback", handler: feedback },
  { method: "GET", path: "/reviews/settings", handler: settings },
  { method: "PATCH", path: "/reviews/settings", handler: saveSettings },
  {
    method: "POST",
    path: "/reviews/send",
    handler: async (r: ApiRequest) => {
      await needAvis();
      const customerId = str(r.body.customerId, 40);
      return ok(await sendReviewRequest(customerId ? { customerId } : { email: str(r.body.email, 200), name: str(r.body.name, 80) }));
    },
  },
  {
    method: "POST",
    path: "/reviews/qr/regenerate",
    handler: async () => {
      await needAvis();
      return ok(await regenerateReviewQr());
    },
  },
];

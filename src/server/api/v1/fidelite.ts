import "server-only";
import { headers } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { addStamp, cancelGiftCard, createGiftCard, currentLoyaltyQr, redeemGiftCard, redeemReward, saveLoyaltySettings } from "@/server/actions/loyalty";
import { bool, fail, forbidden, has, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { giftCardsOf, loyaltyCardsOf, loyaltyOrigin, loyaltyRights, loyaltySettingsOf } from "@/server/loyalty";
import { todayIn } from "@/lib/planning";
import { isLocked } from "@/server/plan";

/** API mobile de l'app Fidélité (Skydev) : carte à tampons, QR code du comptoir, cartes cadeaux. */

async function needFidelite(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("fidelite")) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

type Res = { ok: boolean; error?: string; message?: string; id?: string; code?: string; reward?: boolean };
const ok = (r: Res) => (r.ok ? { ok: true, message: r.message ?? null, id: r.id ?? null, code: r.code ?? null, reward: r.reward ?? false } : invalid(r.error ?? "Action impossible."));

async function overview() {
  const ctx = await needFidelite();
  const [s, cards, clients] = await Promise.all([
    loyaltySettingsOf(ctx.business.id),
    loyaltyCardsOf(ctx.business.id),
    db.select({ id: customers.id, name: customers.fullName, email: customers.email, phone: customers.phone }).from(customers).where(eq(customers.businessId, ctx.business.id)).orderBy(asc(customers.fullName)).limit(5000),
  ]);
  return {
    canManage: loyaltyRights(ctx).manage,
    settings: { goal: s.goal, reward: s.reward, autoAppointment: s.autoAppointment, autoShop: s.autoShop, qrEnabled: s.qrEnabled },
    cards: cards.map((c) => ({ id: c.id, stamps: c.stamps, rewards: c.rewards, last: c.last?.toISOString() ?? null, customerId: c.customerId, name: c.name, email: c.email, url: `${loyaltyOrigin()}/fidelite/${c.token}` })),
    clients,
  };
}

async function saveSettings(r: ApiRequest) {
  const ctx = await needFidelite();
  const cur = await loyaltySettingsOf(ctx.business.id);
  const b = r.body;
  ok(
    await saveLoyaltySettings({
      goal: has(b, "goal") ? Math.round(Number(b.goal)) || cur.goal : cur.goal,
      reward: has(b, "reward") ? str(b.reward, 120) : cur.reward,
      autoAppointment: has(b, "autoAppointment") ? bool(b.autoAppointment) : cur.autoAppointment,
      autoShop: has(b, "autoShop") ? bool(b.autoShop) : cur.autoShop,
      qrEnabled: has(b, "qrEnabled") ? bool(b.qrEnabled) : cur.qrEnabled,
    }),
  );
  return overview();
}

async function giftCards() {
  const ctx = await needFidelite();
  const rows = await giftCardsOf(ctx.business.id);
  return {
    today: todayIn(ctx.business.timezone),
    canManage: loyaltyRights(ctx).manage,
    cards: rows.map((g) => ({ id: g.id, code: g.code, initial: g.initialCents, balance: g.balanceCents, buyer: g.buyerName, recipient: g.recipientName, message: g.message, expiresOn: g.expiresOn, cancelled: !!g.cancelledAt, createdAt: g.createdAt.toISOString() })),
  };
}

export const fideliteRoutes: Route[] = [
  { method: "GET", path: "/loyalty", handler: overview },
  { method: "PATCH", path: "/loyalty/settings", handler: saveSettings },
  {
    method: "POST",
    path: "/loyalty/stamp",
    handler: async (r) => {
      await needFidelite();
      return ok(await addStamp(str(r.body.customerId, 40)));
    },
  },
  {
    method: "POST",
    path: "/loyalty/cards/:id/redeem",
    handler: async (r) => {
      await needFidelite();
      return ok(await redeemReward(r.params.id!));
    },
  },
  {
    method: "GET",
    path: "/loyalty/qr",
    handler: async () => {
      const ctx = await needFidelite();
      const s = await loyaltySettingsOf(ctx.business.id);
      const q = await currentLoyaltyQr();
      if (!q.ok) return { enabled: false, error: q.error, business: ctx.business.name, goal: s.goal, reward: s.reward };
      return { enabled: true, url: q.url, expiresIn: q.expiresIn, business: ctx.business.name, goal: s.goal, reward: s.reward };
    },
  },
  { method: "GET", path: "/gift-cards", handler: giftCards },
  {
    method: "POST",
    path: "/gift-cards",
    handler: async (r) => {
      await needFidelite();
      const b = r.body;
      return ok(await createGiftCard({ amount: str(b.amount, 12), buyerName: str(b.buyerName, 120), recipientName: str(b.recipientName, 120), message: str(b.message, 300), months: Math.round(Number(b.months)) || 12 }));
    },
  },
  {
    method: "POST",
    path: "/gift-cards/redeem",
    handler: async (r) => {
      await needFidelite();
      return ok(await redeemGiftCard({ code: str(r.body.code, 20), amount: str(r.body.amount, 12), note: str(r.body.note, 200) }));
    },
  },
  {
    method: "POST",
    path: "/gift-cards/:id/cancel",
    handler: async (r) => {
      await needFidelite();
      return ok(await cancelGiftCard(r.params.id!));
    },
  },
];

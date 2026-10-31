import "server-only";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { posSales } from "@/db/schema";
import { closeRegister, openRegister, refundSale, sell } from "@/server/actions/pos";
import { fail, forbidden, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { getSellerSettings } from "@/server/invoicing";
import { isLocked } from "@/server/plan";
import { openSessionOf, productsOf, salesToday, sessionsOf, sessionTotals, stockRights } from "@/server/stock";

/** API mobile de l'app Caisse (Skydev) : ouverture, encaissement, tickets, remboursement, clôture. */

async function needPos(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("caisse")) return forbidden();
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
const cents = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : -1;
};

async function register() {
  const ctx = await needPos();
  const session = await openSessionOf(ctx.business.id);
  const canManage = stockRights(ctx).manage;
  if (!session) return { open: false, canManage, session: null, products: [], franchise: false };
  const [list, t, seller] = await Promise.all([productsOf(ctx.business.id, { activeOnly: true }), sessionTotals(ctx.business.id, session.id), getSellerSettings(ctx.business.id)]);
  return {
    open: true,
    canManage,
    franchise: seller.vatRegime === "franchise",
    session: { id: session.id, openedAt: session.openedAt.toISOString(), openingCashCents: session.openingCashCents, expectedCashCents: session.openingCashCents + t.cash - t.refundedCash, totals: t },
    products: list.filter((p) => !p.isModel).map((p) => ({ id: p.id, name: p.name, category: p.category, barcode: p.barcode, priceCents: p.priceCents, vatRate: p.vatRate, trackStock: p.trackStock, stockQty: p.stockQty, photoUrl: p.photoUrl, size: p.size, color: p.color })),
  };
}

type SaleLine = { productId: string | null; qty: number; name?: string; unitCents?: number; vatRate?: number };

export const caisseRoutes: Route[] = [
  { method: "GET", path: "/pos", handler: register },
  {
    method: "POST",
    path: "/pos/open",
    handler: async (r) => {
      await needPos();
      const c = cents(r.body.openingCashCents);
      if (c < 0) return invalid("Fond de caisse invalide.");
      const res = ok(await openRegister(c));
      return { ok: true, message: res.message ?? null };
    },
  },
  {
    method: "POST",
    path: "/pos/close",
    handler: async (r) => {
      await needPos();
      const c = cents(r.body.countedCashCents);
      if (c < 0) return invalid("Montant compté invalide.");
      const res = ok(await closeRegister({ countedCashCents: c, note: str(r.body.note, 500) }));
      return { ok: true, id: res.id ?? null, message: res.message ?? null };
    },
  },
  {
    method: "POST",
    path: "/pos/sell",
    handler: async (r: ApiRequest) => {
      await needPos();
      const b = r.body;
      const raw = Array.isArray(b.lines) ? (b.lines as Record<string, unknown>[]) : [];
      const lines: SaleLine[] = raw.slice(0, 100).map((l) =>
        uuid(l.productId)
          ? { productId: l.productId as string, qty: Math.round(Number(l.qty) || 1) }
          : { productId: null, qty: Math.round(Number(l.qty) || 1), name: str(l.name, 120), unitCents: cents(l.unitCents), vatRate: Number(l.vatRate) },
      );
      const method = b.method === "card" ? "card" : b.method === "other" ? "other" : "cash";
      const given = b.cashGivenCents == null || b.cashGivenCents === "" ? null : cents(b.cashGivenCents);
      const res = ok(await sell({ lines, discountCents: Math.max(0, cents(b.discountCents)), method, cashGivenCents: given !== null && given >= 0 ? given : null, customerId: uuid(b.customerId) ? (b.customerId as string) : null }));
      return { ok: true, id: res.id ?? null, number: res.number ?? null, change: res.change ?? null, message: res.message ?? null };
    },
  },
  {
    method: "GET",
    path: "/pos/tickets",
    handler: async () => {
      const ctx = await needPos();
      const rows = await salesToday(ctx.business.id, 30);
      return {
        canRefund: stockRights(ctx).manage,
        tickets: rows.map((s) => ({ id: s.id, number: s.number, totalCents: s.totalCents, method: s.method, status: s.status, createdAt: s.createdAt.toISOString(), items: s.lines.reduce((a, l) => a + l.qty, 0) })),
      };
    },
  },
  {
    method: "GET",
    path: "/pos/tickets/:id",
    handler: async (r) => {
      const ctx = await needPos();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Ticket introuvable.");
      const [s] = await db.select().from(posSales).where(and(eq(posSales.id, r.params.id!), eq(posSales.businessId, ctx.business.id)));
      if (!s) return fail(404, "not_found", "Ticket introuvable.");
      return {
        canRefund: stockRights(ctx).manage,
        ticket: { id: s.id, number: s.number, lines: s.lines, discountCents: s.discountCents, totalCents: s.totalCents, vatCents: s.vatCents, method: s.method, cashGivenCents: s.cashGivenCents, status: s.status, refundedAt: s.refundedAt?.toISOString() ?? null, createdAt: s.createdAt.toISOString() },
      };
    },
  },
  {
    method: "POST",
    path: "/pos/tickets/:id/refund",
    handler: async (r) => {
      await needPos();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Ticket introuvable.");
      const res = ok(await refundSale(r.params.id!));
      return { ok: true, message: res.message ?? null };
    },
  },
  {
    method: "GET",
    path: "/pos/sessions",
    handler: async () => {
      const ctx = await needPos();
      const rows = await sessionsOf(ctx.business.id);
      return {
        sessions: rows.map(({ s, opener }) => ({ id: s.id, openedAt: s.openedAt.toISOString(), closedAt: s.closedAt?.toISOString() ?? null, opener, openingCashCents: s.openingCashCents, countedCashCents: s.countedCashCents, expectedCashCents: s.expectedCashCents, totals: s.totals ?? null, note: s.note })),
      };
    },
  },
];

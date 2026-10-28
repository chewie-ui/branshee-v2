import "server-only";
import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, posSales, posSessions, products, stockMoves } from "@/db/schema";
import type { AppContext } from "@/server/context";

/** Tout le monde vend et réceptionne. Prix, fiches produits, remboursements : le responsable ou qui gère les réglages. */
export const stockRights = (ctx: AppContext) => ({ manage: ctx.member.isOwner || ctx.can("settings.manage") });

export type ProductView = { id: string; name: string; sku: string | null; barcode: string | null; category: string | null; priceCents: number; vatRate: number; costCents: number | null; trackStock: boolean; stockQty: number; minQty: number | null; supplier: string | null; photoUrl: string | null; active: boolean };

export async function productsOf(businessId: string, opts: { activeOnly?: boolean } = {}): Promise<ProductView[]> {
  return db
    .select({ id: products.id, name: products.name, sku: products.sku, barcode: products.barcode, category: products.category, priceCents: products.priceCents, vatRate: products.vatRate, costCents: products.costCents, trackStock: products.trackStock, stockQty: products.stockQty, minQty: products.minQty, supplier: products.supplier, photoUrl: products.photoUrl, active: products.active })
    .from(products)
    .where(and(eq(products.businessId, businessId), opts.activeOnly ? eq(products.active, true) : undefined))
    .orderBy(asc(products.category), asc(products.name))
    .limit(5000);
}

export async function movesOf(businessId: string, productId?: string) {
  return db
    .select({ id: stockMoves.id, delta: stockMoves.delta, reason: stockMoves.reason, note: stockMoves.note, createdAt: stockMoves.createdAt, product: products.name, productId: products.id, by: members.displayName })
    .from(stockMoves)
    .innerJoin(products, eq(products.id, stockMoves.productId))
    .leftJoin(members, eq(members.id, stockMoves.memberId))
    .where(and(eq(stockMoves.businessId, businessId), productId ? eq(stockMoves.productId, productId) : undefined))
    .orderBy(desc(stockMoves.createdAt))
    .limit(500);
}

export async function openSessionOf(businessId: string) {
  const [s] = await db.select().from(posSessions).where(and(eq(posSessions.businessId, businessId), isNull(posSessions.closedAt)));
  return s ?? null;
}

/** Totaux d'une session de caisse (pour la clôture et le rapport Z). */
export async function sessionTotals(businessId: string, sessionId: string) {
  const rows = await db
    .select({ method: posSales.method, status: posSales.status, n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${posSales.totalCents}), 0)::int`, vat: sql<number>`coalesce(sum(${posSales.vatCents}), 0)::int` })
    .from(posSales)
    .where(and(eq(posSales.businessId, businessId), eq(posSales.sessionId, sessionId)))
    .groupBy(posSales.method, posSales.status);
  const paid = rows.filter((r) => r.status === "paid");
  const by = (m: string) => paid.filter((r) => r.method === m).reduce((a, r) => a + r.total, 0);
  return {
    tickets: paid.reduce((a, r) => a + r.n, 0),
    total: paid.reduce((a, r) => a + r.total, 0),
    vat: paid.reduce((a, r) => a + r.vat, 0),
    cash: by("cash"),
    card: by("card"),
    other: by("other"),
    refunded: rows.filter((r) => r.status === "refunded").reduce((a, r) => a + r.total, 0),
    refundedCash: rows.filter((r) => r.status === "refunded" && r.method === "cash").reduce((a, r) => a + r.total, 0),
  };
}

export async function salesToday(businessId: string, since: Date) {
  return db.select().from(posSales).where(and(eq(posSales.businessId, businessId), gte(posSales.createdAt, since))).orderBy(desc(posSales.createdAt)).limit(300);
}

export async function sessionsOf(businessId: string) {
  return db.select({ s: posSessions, opener: members.displayName }).from(posSessions).leftJoin(members, eq(members.id, posSessions.openedById)).where(eq(posSessions.businessId, businessId)).orderBy(desc(posSessions.openedAt)).limit(200);
}

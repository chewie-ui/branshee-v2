import "server-only";
import { and, asc, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, invoiceSettings, members, paymentSettings, products, shopOrders, shopSettings, stockMoves, users } from "@/db/schema";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";

const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);
import type { AppContext } from "@/server/context";

export const shopRights = (ctx: AppContext) => ({ manage: ctx.member.isOwner || ctx.can("settings.manage") });
export const shopOrigin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");
export const DEFAULT_SHOP = { enabled: false, pickup: true, pickupNote: null, delivery: false, deliveryCents: 0, freeDeliveryFromCents: null, deliveryNote: null, payOnline: false, payOnPickup: true, payTransfer: false, intro: null };

export async function shopSettingsOf(businessId: string) {
  const [s] = await db.select().from(shopSettings).where(eq(shopSettings.businessId, businessId));
  return s ?? { businessId, ...DEFAULT_SHOP };
}

export async function stripeDestination(businessId: string) {
  const [ps] = await db.select({ acct: paymentSettings.stripeAccountId, status: paymentSettings.stripeStatus }).from(paymentSettings).where(eq(paymentSettings.businessId, businessId));
  return ps?.status === "active" && ps.acct ? ps.acct : null;
}

/** Boutique publique : établissement visible, boutique activée, produits en ligne. */
export async function publicShop(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const [b] = await db.select({ id: businesses.id, name: businesses.name, slug: businesses.slug, photoUrl: businesses.photoUrl, city: businesses.city }).from(businesses).where(and(eq(businesses.slug, slug), isNull(businesses.deletedAt), isNull(businesses.pausedAt)));
  if (!b) return null;
  const s = await shopSettingsOf(b.id);
  if (!s.enabled) return null;
  const [items, [seller], dest] = await Promise.all([
    db.select({ id: products.id, name: products.name, description: products.description, category: products.category, priceCents: products.priceCents, photoUrl: products.photoUrl, trackStock: products.trackStock, stockQty: products.stockQty }).from(products).where(and(eq(products.businessId, b.id), eq(products.active, true), eq(products.onlineEnabled, true))).orderBy(asc(products.category), asc(products.name)),
    db.select({ iban: invoiceSettings.iban, legalName: invoiceSettings.legalName, street: invoiceSettings.street, zip: invoiceSettings.zip, city: invoiceSettings.city, vat: invoiceSettings.vatNumber, bce: invoiceSettings.bce, email: invoiceSettings.email }).from(invoiceSettings).where(eq(invoiceSettings.businessId, b.id)),
    stripeDestination(b.id),
  ]);
  return { business: b, settings: s, items, seller: seller ?? null, canPayOnline: s.payOnline && !!dest };
}

export async function shopOrdersOf(businessId: string) {
  return db.select().from(shopOrders).where(eq(shopOrders.businessId, businessId)).orderBy(desc(shopOrders.createdAt)).limit(500);
}

export async function orderByToken(token: string) {
  if (!/^[\w-]{16,40}$/.test(token)) return null;
  const [r] = await db.select({ o: shopOrders, business: businesses.name, slug: businesses.slug }).from(shopOrders).innerJoin(businesses, eq(businesses.id, shopOrders.businessId)).where(eq(shopOrders.token, token));
  return r ?? null;
}

/** Emails : confirmation au client, alerte au responsable. */
export async function notifyNewOrder(orderId: string) {
  const [o] = await db.select().from(shopOrders).where(eq(shopOrders.id, orderId));
  if (!o) return;
  const shopName = (await db.execute<{ name: string }>(sql`select name from businesses where id = ${o.businessId}`))[0]?.name ?? "";
  await sendEmail({ to: o.email, ...emails.shopOrderConfirm({ shopName, number: o.number, total: eur(o.totalCents), lines: o.lines.map((l) => `${l.qty} × ${l.name}`), pay: o.payMethod, fulfilment: o.fulfilment, url: `${shopOrigin()}/commande/${o.token}` }), template: "shop_order_confirm", businessId: o.businessId }).catch(() => {});
  const [owner] = await db.select({ email: users.email }).from(members).innerJoin(users, eq(users.id, members.userId)).where(and(eq(members.businessId, o.businessId), eq(members.isOwner, true)));
  if (owner) await sendEmail({ to: owner.email, ...emails.shopOrderNew({ shopName, number: o.number, total: eur(o.totalCents), name: o.name, url: `${shopOrigin()}/app/boutique` }), template: "shop_order_new", businessId: o.businessId }).catch(() => {});
}

/** Annule une commande et rend le stock réservé (une seule fois, même appelée deux fois). */
export async function cancelShopOrderAndRestock(orderId: string, by?: string | null) {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(shopOrders).where(eq(shopOrders.id, orderId)).for("update");
    if (!o || o.status === "cancelled") return false;
    await tx.update(shopOrders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(shopOrders.id, o.id));
    const moves = await tx.select({ productId: stockMoves.productId, delta: stockMoves.delta }).from(stockMoves).where(and(eq(stockMoves.saleId, o.id), eq(stockMoves.reason, "sale")));
    for (const m of moves) {
      await tx.update(products).set({ stockQty: sql`${products.stockQty} + ${-m.delta}`, lowNotifiedAt: null, updatedAt: new Date() }).where(eq(products.id, m.productId));
      await tx.insert(stockMoves).values({ businessId: o.businessId, productId: m.productId, delta: -m.delta, reason: "refund", note: `Boutique n° ${o.number} annulée`, memberId: by ?? null, saleId: o.id });
    }
    return true;
  });
}

/** Webhook Stripe : paiement de la boutique reçu (idempotent). */
export async function completeShopPayment(session: { id: string; payment_status: string; metadata: Record<string, string> | null }) {
  if (session.metadata?.type !== "shop_order" || session.payment_status !== "paid") return false;
  const id = session.metadata.orderId;
  if (!id) return false;
  const done = await db.update(shopOrders).set({ status: "new", paidAt: new Date(), updatedAt: new Date() }).where(and(eq(shopOrders.id, id), eq(shopOrders.stripeSessionId, session.id), eq(shopOrders.status, "pending_payment"))).returning({ id: shopOrders.id });
  if (done.length) await notifyNewOrder(id);
  return true;
}

/** Paiements en ligne abandonnés (plus de 2 heures) : commande annulée, stock rendu. */
export async function expireUnpaidShopOrders() {
  const rows = await db.select({ id: shopOrders.id }).from(shopOrders).where(and(eq(shopOrders.status, "pending_payment"), lt(shopOrders.createdAt, new Date(Date.now() - 2 * 3600_000)))).limit(200);
  let n = 0;
  for (const r of rows) if (await cancelShopOrderAndRestock(r.id)) n++;
  return n;
}

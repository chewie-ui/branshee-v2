"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { products, shopOrders, stockMoves, type ShopLine } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";
import { MAX_SHOP_QTY, deliveryFee } from "@/lib/shop";
import { rateLimit } from "@/server/auth/rate-limit";
import { stripe } from "@/server/payments";
import { notifyNewOrder, publicShop, shopOrigin, stripeDestination } from "@/server/shop";

type Result = { ok: true; url: string } | { ok: false; error: string };

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  lines: z.array(z.object({ productId: z.uuid(), qty: z.number().int().min(1).max(MAX_SHOP_QTY) })).min(1, "Votre panier est vide.").max(50),
  fulfilment: z.enum(["pickup", "delivery"]),
  payMethod: z.enum(["online", "pickup", "transfer"]),
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email: z.email({ message: "Email invalide." }),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(300),
  note: z.string().trim().max(500),
  terms: z.literal(true, { message: "Acceptez les conditions de vente." }),
});

/**
 * Commande sur la boutique en ligne (sans compte). Prix et stock viennent de la base ; le stock est réservé
 * tout de suite (rendu si la commande est annulée ou si le paiement en ligne n'aboutit pas).
 */
export async function placeShopOrder(input: z.input<typeof schema>): Promise<Result> {
  const v = schema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Commande invalide." };
  const d = v.data;
  if (!rateLimit(`shop:${clientIp(await headers()) ?? "?"}`, 10, 3600_000).ok) return { ok: false, error: "Trop de commandes. Réessayez plus tard." };
  const units = d.lines.reduce((a, l) => a + l.qty, 0);
  if (units > 100) return { ok: false, error: "100 articles maximum par commande : contactez la boutique pour une grosse commande." };
  const shop = await publicShop(d.slug);
  if (!shop) return { ok: false, error: "Cette boutique n'est pas disponible." };
  const s = shop.settings;
  if (d.fulfilment === "pickup" && !s.pickup) return { ok: false, error: "Le retrait n'est pas proposé." };
  if (d.fulfilment === "delivery" && !s.delivery) return { ok: false, error: "La livraison n'est pas proposée." };
  if (d.fulfilment === "delivery" && d.address.length < 8) return { ok: false, error: "Indiquez l'adresse de livraison." };
  if ((d.payMethod === "online" && !shop.canPayOnline) || (d.payMethod === "pickup" && !s.payOnPickup) || (d.payMethod === "transfer" && !s.payTransfer)) return { ok: false, error: "Moyen de paiement indisponible." };
  const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(shopOrders).where(and(eq(shopOrders.businessId, shop.business.id), eq(shopOrders.email, d.email.toLowerCase()), sql`${shopOrders.createdAt} > now() - interval '1 hour'`));
  if ((recent?.n ?? 0) >= 3) return { ok: false, error: "Vous avez déjà passé plusieurs commandes : contactez la boutique." };
  const qty = new Map<string, number>();
  for (const l of d.lines) qty.set(l.productId, Math.min(MAX_SHOP_QTY, (qty.get(l.productId) ?? 0) + l.qty));
  const token = randomBytes(18).toString("base64url");
  const order = await db.transaction(async (tx) => {
    const items = await tx.select().from(products).where(and(eq(products.businessId, shop.business.id), inArray(products.id, [...qty.keys()]), eq(products.active, true), eq(products.onlineEnabled, true))).orderBy(products.id).for("update");
    if (items.length !== qty.size) return { error: "Un produit de votre panier n'est plus en vente. Rechargez la page." };
    const lines: ShopLine[] = [];
    for (const p of items) {
      const q = qty.get(p.id)!;
      if (p.trackStock && p.stockQty < q) return { error: `Plus que ${Math.max(0, p.stockQty)} « ${p.name} » en stock.` };
      lines.push({ productId: p.id, name: p.name, qty: q, unitCents: p.priceCents, vatRate: p.vatRate });
    }
    const itemsCents = lines.reduce((a, l) => a + l.qty * l.unitCents, 0);
    const delivery = d.fulfilment === "delivery" ? deliveryFee(itemsCents, s) : 0;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${shop.business.id}:shop`}))`);
    const [{ n }] = await tx.select({ n: sql<number>`coalesce(max(${shopOrders.number}), 0)::int + 1` }).from(shopOrders).where(eq(shopOrders.businessId, shop.business.id));
    const [row] = await tx.insert(shopOrders).values({ businessId: shop.business.id, number: n, status: d.payMethod === "online" ? "pending_payment" : "new", payMethod: d.payMethod, fulfilment: d.fulfilment, name: d.name, email: d.email.toLowerCase(), phone: d.phone || null, address: d.fulfilment === "delivery" ? d.address : null, note: d.note || null, lines, itemsCents, deliveryCents: delivery, totalCents: itemsCents + delivery, token }).returning();
    for (const p of items.filter((x) => x.trackStock)) {
      await tx.update(products).set({ stockQty: sql`${products.stockQty} - ${qty.get(p.id)!}`, updatedAt: new Date() }).where(eq(products.id, p.id));
      await tx.insert(stockMoves).values({ businessId: shop.business.id, productId: p.id, delta: -qty.get(p.id)!, reason: "sale", note: `Boutique n° ${n}`, saleId: row!.id });
    }
    return { row: row! };
  });
  if ("error" in order) return { ok: false, error: order.error! };
  const o = order.row;
  const track = `${shopOrigin()}/commande/${token}`;
  if (d.payMethod === "online") {
    const st = stripe();
    const dest = await stripeDestination(shop.business.id);
    if (!st || !dest) return { ok: true, url: track };
    try {
      const session = await st.checkout.sessions.create({
        mode: "payment",
        customer_email: o.email,
        line_items: [...o.lines.map((l) => ({ quantity: l.qty, price_data: { currency: "eur", unit_amount: l.unitCents, product_data: { name: l.name } } })), ...(o.deliveryCents ? [{ quantity: 1, price_data: { currency: "eur", unit_amount: o.deliveryCents, product_data: { name: "Livraison" } } }] : [])],
        payment_intent_data: { transfer_data: { destination: dest }, description: `${shop.business.name} — commande n° ${o.number}` },
        metadata: { type: "shop_order", orderId: o.id, businessId: shop.business.id },
        success_url: `${track}?paye=1`,
        cancel_url: `${track}?annule=1`,
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      });
      await db.update(shopOrders).set({ stripeSessionId: session.id }).where(eq(shopOrders.id, o.id));
      return { ok: true, url: session.url ?? track };
    } catch (e) {
      console.error("[boutique] paiement :", e);
      return { ok: true, url: track };
    }
  }
  await notifyNewOrder(o.id);
  return { ok: true, url: track };
}


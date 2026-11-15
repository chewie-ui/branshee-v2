"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { products, shopOrders, stockMoves, type ShopLine } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";
import { MAX_SHOP_QTY, deliveryFee } from "@/lib/shop";
import { rateLimit } from "@/server/auth/rate-limit";
import { stripe } from "@/server/payments";
import { cancelShopOrderAndRestock, notifyNewOrder, publicShop, shopOrigin, stripeDestination } from "@/server/shop";
import { priceSelection, promoPrice } from "@/lib/product-options";
import { computeDiscounts, dealLive, inTarget, toUnits, todayBrussels, type Deal } from "@/lib/deals";

type Result = { ok: true; url: string } | { ok: false; error: string };

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  // choices : options choisies (pain, suppléments…) ; le prix est recalculé ici, jamais pris du navigateur.
  lines: z.array(z.object({ productId: z.uuid(), qty: z.number().int().min(1).max(MAX_SHOP_QTY), choices: z.array(z.string().regex(/^[a-z0-9]{4,16}$/)).max(60).optional().default([]) })).max(50),
  // Menus : un produit choisi par emplacement (ex. sandwich + boisson + dessert), au prix fixe du menu.
  menus: z.array(z.object({ menuId: z.string().regex(/^[a-z0-9]{4,16}$/), qty: z.number().int().min(1).max(MAX_SHOP_QTY), picks: z.array(z.uuid()).min(2).max(8) })).max(20).optional().default([]),
  fulfilment: z.enum(["pickup", "delivery"]),
  payMethod: z.enum(["online", "pickup", "transfer"]),
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email: z.email({ message: "Email invalide." }),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(300),
  note: z.string().trim().max(500),
  pickupAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal("")).optional().default(""),
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
  // Quantité totale par produit (pour le stock), toutes options confondues.
  if (!d.lines.length && !d.menus.length) return { ok: false, error: "Votre panier est vide." };
  const today = todayBrussels();
  const menuDefs = new Map((s.deals ?? []).filter((x): x is Extract<Deal, { kind: "menu" }> => x.kind === "menu" && dealLive(x, today)).map((m) => [m.id, m]));
  for (const m of d.menus) if (!menuDefs.has(m.menuId) || m.picks.length !== menuDefs.get(m.menuId)!.slots.length) return { ok: false, error: "Un menu de votre panier n'est plus proposé. Rechargez la page." };
  // Quantité totale par produit (stock) : articles seuls + produits choisis dans les menus.
  const qty = new Map<string, number>();
  for (const l of d.lines) qty.set(l.productId, (qty.get(l.productId) ?? 0) + l.qty);
  for (const m of d.menus) for (const pid of m.picks) qty.set(pid, (qty.get(pid) ?? 0) + m.qty);
  if ([...qty.values()].some((q) => q > MAX_SHOP_QTY)) return { ok: false, error: `${MAX_SHOP_QTY} exemplaires maximum par produit.` };
  const token = randomBytes(18).toString("base64url");
  const order = await db.transaction(async (tx) => {
    const items = await tx.select().from(products).where(and(eq(products.businessId, shop.business.id), inArray(products.id, [...qty.keys()]), eq(products.active, true), eq(products.onlineEnabled, true), eq(products.isModel, false))).orderBy(products.id).for("update");
    if (items.length !== qty.size) return { error: "Un produit de votre panier n'est plus en vente. Rechargez la page." };
    const byId = new Map(items.map((p) => [p.id, p]));
    for (const p of items) {
      const q = qty.get(p.id)!;
      if (p.trackStock && p.stockQty < q) return { error: `Plus que ${Math.max(0, p.stockQty)} « ${p.name} » en stock.` };
    }
    // Une ligne par produit + options : prix = prix du jour (promo comprise) + suppléments, recalculés ici.
    const merged = new Map<string, ShopLine>();
    for (const l of d.lines) {
      const p = byId.get(l.productId)!;
      const sel = priceSelection(p.options ?? [], [...new Set(l.choices)]);
      if (!sel) return { error: `« ${p.name} » : vérifiez les options choisies (un choix obligatoire manque ou n'existe plus). Rechargez la page.` };
      const unit = (promoPrice(p) ?? p.priceCents) + sel.extraCents;
      const name = sel.label ? `${p.name} (${sel.label})` : p.name;
      const key = `${p.id}|${[...new Set(l.choices)].sort().join(",")}`;
      const prev = merged.get(key);
      merged.set(key, prev ? { ...prev, qty: prev.qty + l.qty } : { productId: p.id, name, qty: l.qty, unitCents: unit, vatRate: p.vatRate });
    }
    // Promos « X achetés → Y à −Z % » sur les articles seuls (pas ceux des menus), calculées ici.
    const units = toUnits([...merged.values()].map((l) => ({ ...l, category: byId.get(l.productId)!.category })));
    const discounts = computeDiscounts(units, s.deals ?? [], today);
    // Menus : chaque choix doit appartenir à son emplacement ; prix fixe du menu.
    const menuLines: ShopLine[] = [];
    for (const m of d.menus) {
      const def = menuDefs.get(m.menuId)!;
      const picked = m.picks.map((pid) => byId.get(pid)!);
      const bad = def.slots.findIndex((slot, i) => !inTarget(slot.target, picked[i]!));
      if (bad >= 0) return { error: `Menu « ${def.name} » : « ${picked[bad]!.name} » ne peut pas être choisi pour « ${def.slots[bad]!.label} ». Rechargez la page.` };
      const name = `${def.name} (${picked.map((p) => p.name).join(", ")})`;
      const prev = menuLines.find((x) => x.name === name);
      if (prev) prev.qty += m.qty; else menuLines.push({ productId: "", name, qty: m.qty, unitCents: def.priceCents, vatRate: def.vatRate });
    }
    const lines = [...merged.values(), ...menuLines, ...discounts.map((x) => ({ productId: "", name: `Promo : ${x.name}`, qty: 1, unitCents: -x.cents, vatRate: x.vatRate }))];
    const itemsCents = lines.reduce((a, l) => a + l.qty * l.unitCents, 0);
    const delivery = d.fulfilment === "delivery" ? deliveryFee(itemsCents, s) : 0;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${shop.business.id}:shop`}))`);
    const [{ n }] = await tx.select({ n: sql<number>`coalesce(max(${shopOrders.number}), 0)::int + 1` }).from(shopOrders).where(eq(shopOrders.businessId, shop.business.id));
    const [row] = await tx.insert(shopOrders).values({ businessId: shop.business.id, number: n, status: d.payMethod === "online" ? "pending_payment" : "new", payMethod: d.payMethod, fulfilment: d.fulfilment, name: d.name, email: d.email.toLowerCase(), phone: d.phone || null, address: d.fulfilment === "delivery" ? d.address : null, note: [d.fulfilment === "pickup" && d.pickupAt ? `Retrait souhaité : ${d.pickupAt}` : "", d.note].filter(Boolean).join(" · ") || null, lines, itemsCents, deliveryCents: delivery, totalCents: itemsCents + delivery, token }).returning();
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
    // Paiement en ligne impossible à démarrer : on annule la commande (stock rendu) et le client choisit un autre moyen.
    const fail = async () => { await cancelShopOrderAndRestock(o.id); return { ok: false as const, error: "Le paiement en ligne ne répond pas pour le moment. Réessayez, ou choisissez un autre moyen de paiement." }; };
    if (!st || !dest) return fail();
    try {
      const session = await st.checkout.sessions.create({
        mode: "payment",
        customer_email: o.email,
        // Stripe refuse les montants négatifs : avec une promo, une seule ligne au total de la commande.
        line_items: [...(o.lines.some((l) => l.unitCents < 0) ? [{ quantity: 1, price_data: { currency: "eur", unit_amount: o.itemsCents, product_data: { name: `Commande n° ${o.number} — ${shop.business.name}` } } }] : o.lines.map((l) => ({ quantity: l.qty, price_data: { currency: "eur", unit_amount: l.unitCents, product_data: { name: l.name } } }))), ...(o.deliveryCents ? [{ quantity: 1, price_data: { currency: "eur", unit_amount: o.deliveryCents, product_data: { name: "Livraison" } } }] : [])],
        payment_intent_data: { transfer_data: { destination: dest }, description: `${shop.business.name} — commande n° ${o.number}` },
        metadata: { type: "shop_order", orderId: o.id, businessId: shop.business.id },
        success_url: `${track}?paye=1`,
        cancel_url: `${track}?annule=1`,
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      });
      await db.update(shopOrders).set({ stripeSessionId: session.id }).where(eq(shopOrders.id, o.id));
      if (!session.url) return fail();
      return { ok: true, url: session.url };
    } catch (e) {
      console.error("[boutique] paiement :", e);
      return fail();
    }
  }
  await notifyNewOrder(o.id);
  return { ok: true, url: track };
}


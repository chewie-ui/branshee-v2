import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, businesses, customers, giftCards, loyaltyCards, loyaltyMoves, loyaltySettings, products, shopOrders } from "@/db/schema";
import { sameDay } from "@/lib/loyalty-qr";
import { resolveShopRule, stampsForOrder } from "@/lib/loyalty-rules";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { isLocked } from "@/server/plan";
import type { AppContext } from "@/server/context";

export const loyaltyRights = (ctx: AppContext) => ({ manage: ctx.member.isOwner || ctx.can("settings.manage") });
export const loyaltyOrigin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");

export async function loyaltySettingsOf(businessId: string) {
  const [s] = await db.select().from(loyaltySettings).where(eq(loyaltySettings.businessId, businessId));
  return s ?? { businessId, goal: 10, reward: "Une prestation offerte", autoAppointment: false, autoShop: false, qrEnabled: false, theme: {} as Record<string, unknown>, shopRule: {} as Record<string, unknown> };
}

export async function loyaltyCardsOf(businessId: string) {
  return db
    .select({ id: loyaltyCards.id, stamps: loyaltyCards.stamps, rewards: loyaltyCards.rewardsEarned, token: loyaltyCards.token, last: loyaltyCards.lastStampAt, customerId: customers.id, name: customers.fullName, email: customers.email })
    .from(loyaltyCards)
    .innerJoin(customers, eq(customers.id, loyaltyCards.customerId))
    .where(eq(loyaltyCards.businessId, businessId))
    .orderBy(desc(loyaltyCards.lastStampAt))
    .limit(2000);
}

export async function giftCardsOf(businessId: string) {
  return db.select().from(giftCards).where(eq(giftCards.businessId, businessId)).orderBy(desc(giftCards.createdAt)).limit(1000);
}

/** Carte publique (lien envoyé au client). */
export async function cardByToken(token: string) {
  if (!/^[\w-]{16,40}$/.test(token)) return null;
  const [r] = await db
    .select({ id: loyaltyCards.id, stamps: loyaltyCards.stamps, rewards: loyaltyCards.rewardsEarned, name: customers.firstName, fullName: customers.fullName, hasEmail: sql<boolean>`${customers.email} is not null`, businessId: businesses.id, business: businesses.name, slug: businesses.slug, photoUrl: businesses.photoUrl })
    .from(loyaltyCards)
    .innerJoin(customers, eq(customers.id, loyaltyCards.customerId))
    .innerJoin(businesses, eq(businesses.id, loyaltyCards.businessId))
    .where(and(eq(loyaltyCards.token, token), isNull(businesses.deletedAt)));
  return r ?? null;
}

/** Derniers mouvements d'une carte (page du client). */
export async function cardHistory(cardId: string) {
  return db.select({ delta: loyaltyMoves.delta, kind: loyaltyMoves.kind, source: loyaltyMoves.source, at: loyaltyMoves.createdAt }).from(loyaltyMoves).where(and(eq(loyaltyMoves.cardId, cardId), ne(loyaltyMoves.delta, 0))).orderBy(desc(loyaltyMoves.createdAt)).limit(8);
}

/* ───────── Tampons : un seul point d'entrée (pro, QR scanné, rendez-vous, achat) ───────── */

export type StampSource = "manual" | "qr" | "appointment" | "shop";
export type StampResult =
  | { ok: true; stamps: number; token: string; first: boolean; goal: number; reward: string }
  | { ok: false; reason: "recent" | "today" | "duplicate" };

/** Clé des QR codes « tampon » (dérivée du secret du serveur). */
export function loyaltyQrKey() {
  const secret = process.env.DATA_ENCRYPTION_KEY;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("DATA_ENCRYPTION_KEY manquant");
  return createHmac("sha256", "loyalty-qr").update(secret ?? "dev").digest("hex");
}

/**
 * Code récompense (4 chiffres) affiché sur la carte pleine, que le commerçant voit aussi avant d'offrir.
 * Seul le détenteur du lien secret de la carte le connaît ; il change après chaque récompense offerte.
 */
export function rewardCode(cardId: string, rewardsEarned: number) {
  const h = createHmac("sha256", loyaltyQrKey()).update(`reward:${cardId}:${rewardsEarned}`).digest();
  return String(h.readUInt32BE(0) % 10000).padStart(4, "0");
}

/**
 * Ajoute un tampon. Le pro (manuel) : pas deux en moins de 2 heures (double clic). QR, rendez-vous, achat :
 * un seul par jour et par client, tous canaux confondus. `ref` rend chaque rendez-vous ou achat unique.
 */
export async function giveStamp(p: { businessId: string; timezone: string; customerId: string; source: StampSource; ref?: string; memberId?: string | null; count?: number }): Promise<StampResult> {
  const count = Math.max(1, Math.min(50, p.count ?? 1));
  const s = await loyaltySettingsOf(p.businessId);
  const r = await db.transaction(async (tx) => {
    await tx.insert(loyaltyCards).values({ businessId: p.businessId, customerId: p.customerId, token: randomBytes(16).toString("base64url") }).onConflictDoNothing();
    const [card] = await tx.select().from(loyaltyCards).where(and(eq(loyaltyCards.businessId, p.businessId), eq(loyaltyCards.customerId, p.customerId))).for("update");
    if (!card) return { ok: false as const, reason: "duplicate" as const };
    const now = new Date();
    if (p.source === "manual" && card.lastStampAt && now.getTime() - card.lastStampAt.getTime() < 2 * 3600_000) return { ok: false as const, reason: "recent" as const };
    // Achat en ligne : chaque commande payée ou retirée compte (la règle du commerçant fixe le nombre) ; sinon un par jour.
    if (p.source !== "manual" && p.source !== "shop" && sameDay(card.lastStampAt, now, p.timezone || "Europe/Brussels")) {
      // Déjà tamponné aujourd'hui : on note quand même l'origine, pour ne pas réessayer ce rendez-vous ou cet achat.
      if (p.ref) await tx.insert(loyaltyMoves).values({ businessId: p.businessId, cardId: card.id, delta: 0, kind: "fix", source: p.source, ref: p.ref }).onConflictDoNothing();
      return { ok: false as const, reason: "today" as const };
    }
    const moved = await tx.insert(loyaltyMoves).values({ businessId: p.businessId, cardId: card.id, delta: count, kind: "stamp", source: p.source, ref: p.ref ?? null, memberId: p.memberId ?? null }).onConflictDoNothing().returning({ id: loyaltyMoves.id });
    if (!moved.length) return { ok: false as const, reason: "duplicate" as const };
    const stamps = card.stamps + count;
    await tx.update(loyaltyCards).set({ stamps, lastStampAt: now, updatedAt: now }).where(eq(loyaltyCards.id, card.id));
    return { ok: true as const, stamps, token: card.token, first: card.stamps === 0 && !card.lastStampAt };
  });
  return r.ok ? { ...r, goal: s.goal, reward: s.reward } : r;
}

/** Premier tampon : le client reçoit le lien de sa carte. */
export async function sendLoyaltyWelcome(businessId: string, businessName: string, email: string | null, token: string, goal: number, reward: string, stamps?: number) {
  if (!email) return;
  await sendEmail({ to: email, ...emails.loyaltyWelcome({ businessName, goal, reward, stamps, url: `${loyaltyOrigin()}/fidelite/${token}` }), template: "loyalty_welcome", businessId }).catch(() => {});
}

/** Fiche client retrouvée par son email (ou créée) : pour le QR scanné et les achats de la boutique. */
export async function customerByEmail(businessId: string, c: { email: string; firstName: string; lastName: string; phone?: string | null; userId?: string | null }) {
  const email = c.email.trim().toLowerCase();
  const [found] = await db.select({ id: customers.id, email: customers.email }).from(customers).where(and(eq(customers.businessId, businessId), sql`lower(${customers.email}) = ${email}`));
  if (found) return found;
  const fullName = `${c.firstName} ${c.lastName}`.trim() || email;
  await db.insert(customers).values({ businessId, email, firstName: c.firstName || null, lastName: c.lastName || null, fullName, phone: c.phone || null, userId: c.userId ?? null }).onConflictDoNothing();
  const [row] = await db.select({ id: customers.id, email: customers.email }).from(customers).where(and(eq(customers.businessId, businessId), sql`lower(${customers.email}) = ${email}`));
  return row ?? null;
}

/**
 * Toutes les 15 minutes : tampons automatiques des rendez-vous honorés (terminés depuis 3 heures, le temps
 * de marquer une absence) et des achats payés sur la boutique, pour les entreprises qui l'ont activé.
 */
export async function autoStamps() {
  const on = await db.select({ id: loyaltySettings.businessId, appt: loyaltySettings.autoAppointment, shop: loyaltySettings.autoShop, tz: businesses.timezone, name: businesses.name })
    .from(loyaltySettings)
    .innerJoin(businesses, eq(businesses.id, loyaltySettings.businessId))
    .where(and(or(eq(loyaltySettings.autoAppointment, true), eq(loyaltySettings.autoShop, true)), isNull(businesses.deletedAt)));
  let n = 0;
  const now = Date.now();
  for (const b of on) {
    if (await isLocked(b.id)) continue;
    const tz = b.tz || "Europe/Brussels";
    if (b.appt) {
      const done = await db
        .select({ id: appointments.id, customerId: appointments.customerId, email: customers.email })
        .from(appointments)
        .innerJoin(customers, eq(customers.id, appointments.customerId))
        .where(and(
          eq(appointments.businessId, b.id), eq(appointments.kind, "appointment"), eq(appointments.status, "confirmed"), eq(appointments.noShow, false),
          lt(appointments.endsAt, new Date(now - 3 * 3600_000)), gt(appointments.endsAt, new Date(now - 3 * 86400_000)),
          sql`not exists (select 1 from "loyalty_moves" m where m.business_id = ${b.id} and m.ref = 'appt:' || ${appointments.id})`,
        ))
        .orderBy(asc(appointments.endsAt))
        .limit(500);
      for (const a of done) {
        const r = await giveStamp({ businessId: b.id, timezone: tz, customerId: a.customerId!, source: "appointment", ref: `appt:${a.id}` }).catch(() => null);
        if (r?.ok) { n++; if (r.first) await sendLoyaltyWelcome(b.id, b.name, a.email, r.token, r.goal, r.reward); }
      }
    }
    if (b.shop) {
      const paid = await db
        .select({ id: shopOrders.id })
        .from(shopOrders)
        .where(and(
          // Payée en ligne, ou retirée / livrée (paiement sur place) ; jamais une commande annulée.
          eq(shopOrders.businessId, b.id), ne(shopOrders.status, "cancelled"), or(isNotNull(shopOrders.paidAt), eq(shopOrders.status, "done")),
          gt(sql`coalesce(${shopOrders.paidAt}, ${shopOrders.updatedAt})`, new Date(now - 7 * 86400_000)),
          sql`not exists (select 1 from "loyalty_moves" m where m.business_id = ${b.id} and m.ref = 'order:' || ${shopOrders.id})`,
        ))
        .limit(500);
      for (const o of paid) if ((await stampShopOrder(o.id).catch(() => 0)) > 0) n++;
    }
  }
  return n;
}

/** Absence marquée après coup : le tampon automatique de ce rendez-vous est retiré. */
export async function undoAppointmentStamp(businessId: string, appointmentId: string) {
  await db.transaction(async (tx) => {
    const [m] = await tx.delete(loyaltyMoves).where(and(eq(loyaltyMoves.businessId, businessId), eq(loyaltyMoves.ref, `appt:${appointmentId}`))).returning({ cardId: loyaltyMoves.cardId, delta: loyaltyMoves.delta });
    if (m && m.delta > 0) await tx.update(loyaltyCards).set({ stamps: sql`greatest(0, ${loyaltyCards.stamps} - ${m.delta})`, updatedAt: new Date() }).where(eq(loyaltyCards.id, m.cardId));
  });
}

/** Espace client : les cartes de fidélité du compte (fiches liées au compte ou à son email vérifié). */
export async function cardsOfUser(userId: string, email: string) {
  return db
    .select({ token: loyaltyCards.token, stamps: loyaltyCards.stamps, business: businesses.name, photoUrl: businesses.photoUrl, theme: loyaltySettings.theme, goal: sql<number>`coalesce(${loyaltySettings.goal}, 10)`, reward: sql<string>`coalesce(${loyaltySettings.reward}, 'Une prestation offerte')` })
    .from(loyaltyCards)
    .innerJoin(customers, eq(customers.id, loyaltyCards.customerId))
    .innerJoin(businesses, eq(businesses.id, loyaltyCards.businessId))
    .leftJoin(loyaltySettings, eq(loyaltySettings.businessId, loyaltyCards.businessId))
    .where(and(isNull(businesses.deletedAt), or(eq(customers.userId, userId), sql`lower(${customers.email}) = ${email.toLowerCase()}`)))
    .orderBy(desc(loyaltyCards.lastStampAt))
    .limit(30);
}

/**
 * Tampons d'une commande de la boutique selon la règle du commerçant (dès qu'elle est payée ou retirée).
 * Crée la carte au premier achat et envoie son lien au client. Sans effet si déjà fait, annulée ou non concernée.
 */
export async function stampShopOrder(orderId: string): Promise<number> {
  const [o] = await db.select({ id: shopOrders.id, businessId: shopOrders.businessId, status: shopOrders.status, paidAt: shopOrders.paidAt, email: shopOrders.email, name: shopOrders.name, phone: shopOrders.phone, lines: shopOrders.lines, tz: businesses.timezone, bname: businesses.name }).from(shopOrders).innerJoin(businesses, eq(businesses.id, shopOrders.businessId)).where(eq(shopOrders.id, orderId));
  if (!o || o.status === "cancelled" || (!o.paidAt && o.status !== "done")) return 0;
  const s = await loyaltySettingsOf(o.businessId);
  if (!s.autoShop) return 0;
  const [done] = await db.select({ id: loyaltyMoves.id }).from(loyaltyMoves).where(and(eq(loyaltyMoves.businessId, o.businessId), eq(loyaltyMoves.ref, `order:${o.id}`))).limit(1);
  if (done) return 0;
  const n = await orderStampCount(o.businessId, s.shopRule, o.lines);
  if (n <= 0) return 0;
  const [first, ...rest] = o.name.trim().split(/\s+/);
  const c = await customerByEmail(o.businessId, { email: o.email, firstName: first ?? "", lastName: rest.join(" "), phone: o.phone });
  if (!c) return 0;
  const r = await giveStamp({ businessId: o.businessId, timezone: o.tz || "Europe/Brussels", customerId: c.id, source: "shop", ref: `order:${o.id}`, count: n });
  if (!r.ok) return 0;
  if (r.first) await sendLoyaltyWelcome(o.businessId, o.bname, c.email, r.token, r.goal, r.reward, r.stamps);
  return n;
}

/** Combien de tampons rapporte cette commande (catégories des produits lues en base). */
export async function orderStampCount(businessId: string, ruleRaw: unknown, lines: { productId: string; unitCents: number; qty: number }[]) {
  const rule = resolveShopRule(ruleRaw);
  const ids = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
  const cats = ids.length ? await db.select({ id: products.id, category: products.category }).from(products).where(and(eq(products.businessId, businessId), inArray(products.id, ids))) : [];
  const cat = new Map(cats.map((c) => [c.id, c.category]));
  return stampsForOrder(rule, lines.map((l) => ({ ...l, category: cat.get(l.productId) ?? null })));
}

/** Commande annulée après coup : ses tampons sont retirés de la carte. */
export async function undoOrderStamp(businessId: string, orderId: string) {
  await db.transaction(async (tx) => {
    const [m] = await tx.delete(loyaltyMoves).where(and(eq(loyaltyMoves.businessId, businessId), eq(loyaltyMoves.ref, `order:${orderId}`))).returning({ cardId: loyaltyMoves.cardId, delta: loyaltyMoves.delta });
    if (m && m.delta > 0) await tx.update(loyaltyCards).set({ stamps: sql`greatest(0, ${loyaltyCards.stamps} - ${m.delta})`, updatedAt: new Date() }).where(eq(loyaltyCards.id, m.cardId));
  });
}

/**
 * Le client rejoint la carte de fidélité d'un commerce (depuis sa commande ou son espace client) :
 * la carte est créée tout de suite, et ses achats déjà payés ou retirés (60 derniers jours) donnent leurs tampons.
 */
export async function joinLoyaltyByEmail(businessId: string, who: { email: string; name: string; phone?: string | null; userId?: string | null }) {
  const s = await loyaltySettingsOf(businessId);
  if (!s.autoShop) return { ok: false as const, error: "Ce commerce ne propose pas de carte de fidélité avec les achats en ligne." };
  const [first, ...rest] = who.name.trim().split(/\s+/);
  const c = await customerByEmail(businessId, { email: who.email, firstName: first ?? "", lastName: rest.join(" "), phone: who.phone, userId: who.userId });
  if (!c) return { ok: false as const, error: "Carte impossible à créer." };
  if (who.userId) await db.update(customers).set({ userId: who.userId }).where(and(eq(customers.id, c.id), isNull(customers.userId)));
  const [existing] = await db.select({ token: loyaltyCards.token }).from(loyaltyCards).where(and(eq(loyaltyCards.businessId, businessId), eq(loyaltyCards.customerId, c.id)));
  if (!existing) await db.insert(loyaltyCards).values({ businessId, customerId: c.id, token: randomBytes(16).toString("base64url") }).onConflictDoNothing();
  // Achats passés déjà payés ou retirés, pas encore comptés.
  const past = await db.select({ id: shopOrders.id }).from(shopOrders).where(and(
    eq(shopOrders.businessId, businessId), sql`lower(${shopOrders.email}) = ${who.email.toLowerCase()}`, ne(shopOrders.status, "cancelled"),
    or(isNotNull(shopOrders.paidAt), eq(shopOrders.status, "done")), gt(shopOrders.createdAt, new Date(Date.now() - 60 * 86400_000)),
    sql`not exists (select 1 from "loyalty_moves" m where m.business_id = ${businessId} and m.ref = 'order:' || ${shopOrders.id})`,
  )).limit(50);
  let added = 0;
  for (const o of past) added += await stampShopOrder(o.id).catch(() => 0);
  const [card] = await db.select({ token: loyaltyCards.token, stamps: loyaltyCards.stamps }).from(loyaltyCards).where(and(eq(loyaltyCards.businessId, businessId), eq(loyaltyCards.customerId, c.id)));
  if (!card) return { ok: false as const, error: "Carte impossible à créer." };
  if (!existing && !added) {
    const [b] = await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, businessId));
    await sendLoyaltyWelcome(businessId, b?.name ?? "", who.email, card.token, s.goal, s.reward, card.stamps);
  }
  return { ok: true as const, token: card.token, stamps: card.stamps, added, existed: !!existing };
}

/** Espace client : commerces où l'on a commandé, qui proposent la fidélité sur les achats, sans carte encore. */
export async function joinableLoyalty(userId: string, email: string) {
  const mail = email.toLowerCase();
  return db
    .selectDistinct({ businessId: businesses.id, name: businesses.name, photoUrl: businesses.photoUrl, goal: loyaltySettings.goal, reward: loyaltySettings.reward })
    .from(shopOrders)
    .innerJoin(businesses, eq(businesses.id, shopOrders.businessId))
    .innerJoin(loyaltySettings, eq(loyaltySettings.businessId, shopOrders.businessId))
    .where(and(
      sql`lower(${shopOrders.email}) = ${mail}`, eq(loyaltySettings.autoShop, true), isNull(businesses.deletedAt),
      sql`not exists (select 1 from "loyalty_cards" l join "customers" c on c.id = l.customer_id where l.business_id = ${businesses.id} and (c.user_id = ${userId} or lower(c.email) = ${mail}))`,
    ))
    .limit(20);
}

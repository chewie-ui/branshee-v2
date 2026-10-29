import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, businesses, customers, giftCards, loyaltyCards, loyaltyMoves, loyaltySettings, shopOrders } from "@/db/schema";
import { sameDay } from "@/lib/loyalty-qr";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { isLocked } from "@/server/plan";
import type { AppContext } from "@/server/context";

export const loyaltyRights = (ctx: AppContext) => ({ manage: ctx.member.isOwner || ctx.can("settings.manage") });
export const loyaltyOrigin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");

export async function loyaltySettingsOf(businessId: string) {
  const [s] = await db.select().from(loyaltySettings).where(eq(loyaltySettings.businessId, businessId));
  return s ?? { businessId, goal: 10, reward: "Une prestation offerte", autoAppointment: false, autoShop: false, qrEnabled: false };
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
    .select({ id: loyaltyCards.id, stamps: loyaltyCards.stamps, rewards: loyaltyCards.rewardsEarned, name: customers.firstName, fullName: customers.fullName, businessId: businesses.id, business: businesses.name, slug: businesses.slug, photoUrl: businesses.photoUrl })
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
 * Ajoute un tampon. Le pro (manuel) : pas deux en moins de 2 heures (double clic). QR, rendez-vous, achat :
 * un seul par jour et par client, tous canaux confondus. `ref` rend chaque rendez-vous ou achat unique.
 */
export async function giveStamp(p: { businessId: string; timezone: string; customerId: string; source: StampSource; ref?: string; memberId?: string | null }): Promise<StampResult> {
  const s = await loyaltySettingsOf(p.businessId);
  const r = await db.transaction(async (tx) => {
    await tx.insert(loyaltyCards).values({ businessId: p.businessId, customerId: p.customerId, token: randomBytes(16).toString("base64url") }).onConflictDoNothing();
    const [card] = await tx.select().from(loyaltyCards).where(and(eq(loyaltyCards.businessId, p.businessId), eq(loyaltyCards.customerId, p.customerId))).for("update");
    if (!card) return { ok: false as const, reason: "duplicate" as const };
    const now = new Date();
    if (p.source === "manual" && card.lastStampAt && now.getTime() - card.lastStampAt.getTime() < 2 * 3600_000) return { ok: false as const, reason: "recent" as const };
    if (p.source !== "manual" && sameDay(card.lastStampAt, now, p.timezone || "Europe/Brussels")) {
      // Déjà tamponné aujourd'hui : on note quand même l'origine, pour ne pas réessayer ce rendez-vous ou cet achat.
      if (p.ref) await tx.insert(loyaltyMoves).values({ businessId: p.businessId, cardId: card.id, delta: 0, kind: "fix", source: p.source, ref: p.ref }).onConflictDoNothing();
      return { ok: false as const, reason: "today" as const };
    }
    const moved = await tx.insert(loyaltyMoves).values({ businessId: p.businessId, cardId: card.id, delta: 1, kind: "stamp", source: p.source, ref: p.ref ?? null, memberId: p.memberId ?? null }).onConflictDoNothing().returning({ id: loyaltyMoves.id });
    if (!moved.length) return { ok: false as const, reason: "duplicate" as const };
    const stamps = card.stamps + 1;
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
        .select({ id: shopOrders.id, email: shopOrders.email, name: shopOrders.name, phone: shopOrders.phone })
        .from(shopOrders)
        .where(and(
          eq(shopOrders.businessId, b.id), isNotNull(shopOrders.paidAt), ne(shopOrders.status, "cancelled"), gt(shopOrders.paidAt, new Date(now - 7 * 86400_000)),
          sql`not exists (select 1 from "loyalty_moves" m where m.business_id = ${b.id} and m.ref = 'order:' || ${shopOrders.id})`,
        ))
        .limit(500);
      for (const o of paid) {
        const [first, ...rest] = o.name.trim().split(/\s+/);
        const c = await customerByEmail(b.id, { email: o.email, firstName: first ?? "", lastName: rest.join(" "), phone: o.phone }).catch(() => null);
        if (!c) continue;
        const r = await giveStamp({ businessId: b.id, timezone: tz, customerId: c.id, source: "shop", ref: `order:${o.id}` }).catch(() => null);
        if (r?.ok) { n++; if (r.first) await sendLoyaltyWelcome(b.id, b.name, c.email, r.token, r.goal, r.reward); }
      }
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
    .select({ token: loyaltyCards.token, stamps: loyaltyCards.stamps, business: businesses.name, goal: sql<number>`coalesce(${loyaltySettings.goal}, 10)`, reward: sql<string>`coalesce(${loyaltySettings.reward}, 'Une prestation offerte')` })
    .from(loyaltyCards)
    .innerJoin(customers, eq(customers.id, loyaltyCards.customerId))
    .innerJoin(businesses, eq(businesses.id, loyaltyCards.businessId))
    .leftJoin(loyaltySettings, eq(loyaltySettings.businessId, loyaltyCards.businessId))
    .where(and(isNull(businesses.deletedAt), or(eq(customers.userId, userId), sql`lower(${customers.email}) = ${email.toLowerCase()}`)))
    .orderBy(desc(loyaltyCards.lastStampAt))
    .limit(30);
}

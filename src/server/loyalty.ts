import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, customers, giftCards, loyaltyCards, loyaltySettings } from "@/db/schema";
import type { AppContext } from "@/server/context";

export const loyaltyRights = (ctx: AppContext) => ({ manage: ctx.member.isOwner || ctx.can("settings.manage") });
export const loyaltyOrigin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");

export async function loyaltySettingsOf(businessId: string) {
  const [s] = await db.select().from(loyaltySettings).where(eq(loyaltySettings.businessId, businessId));
  return s ?? { businessId, goal: 10, reward: "Une prestation offerte" };
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
    .select({ stamps: loyaltyCards.stamps, rewards: loyaltyCards.rewardsEarned, name: customers.firstName, fullName: customers.fullName, businessId: businesses.id, business: businesses.name, photoUrl: businesses.photoUrl })
    .from(loyaltyCards)
    .innerJoin(customers, eq(customers.id, loyaltyCards.customerId))
    .innerJoin(businesses, eq(businesses.id, loyaltyCards.businessId))
    .where(and(eq(loyaltyCards.token, token), isNull(businesses.deletedAt)));
  return r ?? null;
}

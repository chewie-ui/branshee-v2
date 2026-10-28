import "server-only";
import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessFeatures, businesses, customRequests, users } from "@/db/schema";

/** Fonctionnalité sur mesure active pour cette entreprise ? (une lecture par requête) */
export const customFeaturesOf = cache(async (businessId: string) => {
  const rows = await db.select({ key: businessFeatures.key }).from(businessFeatures).where(eq(businessFeatures.businessId, businessId));
  return new Set(rows.map((r) => r.key));
});
export const hasCustomFeature = async (businessId: string, key: string) => (await customFeaturesOf(businessId)).has(key);

export async function requestsOf(businessId: string) {
  return db.select().from(customRequests).where(eq(customRequests.businessId, businessId)).orderBy(desc(customRequests.createdAt)).limit(100);
}

export async function featuresOf(businessId: string) {
  return db.select().from(businessFeatures).where(eq(businessFeatures.businessId, businessId));
}

/** Admin : toutes les demandes, avec l'entreprise et la personne qui a demandé. */
export async function allRequests(status?: string) {
  return db
    .select({ r: customRequests, business: businesses.name, businessId: businesses.id, email: users.email, name: users.fullName })
    .from(customRequests)
    .innerJoin(businesses, eq(businesses.id, customRequests.businessId))
    .leftJoin(users, eq(users.id, customRequests.userId))
    .where(status ? eq(customRequests.status, status) : undefined)
    .orderBy(desc(customRequests.createdAt))
    .limit(300);
}

export async function requestById(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await db.select({ r: customRequests, business: businesses.name, businessId: businesses.id, email: users.email, name: users.fullName }).from(customRequests).innerJoin(businesses, eq(businesses.id, customRequests.businessId)).leftJoin(users, eq(users.id, customRequests.userId)).where(eq(customRequests.id, id));
  return r ?? null;
}

export const ownRequest = async (businessId: string, id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await db.select().from(customRequests).where(and(eq(customRequests.businessId, businessId), eq(customRequests.id, id)));
  return r ?? null;
};

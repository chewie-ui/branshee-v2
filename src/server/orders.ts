import "server-only";
import { and, asc, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, diningTables, menuCategories, menuItems, tableOrders } from "@/db/schema";

export type MenuCategoryView = { id: string; name: string; position: number };
export type MenuItemView = { id: string; categoryId: string | null; name: string; description: string | null; priceCents: number; tags: string | null; photoUrl: string | null; available: boolean; position: number };

/** Carte complète d'un établissement (catégories et plats, dans l'ordre choisi). */
export async function menuOf(businessId: string, opts: { onlyAvailable?: boolean } = {}) {
  const [cats, items] = await Promise.all([
    db.select({ id: menuCategories.id, name: menuCategories.name, position: menuCategories.position }).from(menuCategories).where(eq(menuCategories.businessId, businessId)).orderBy(asc(menuCategories.position), asc(menuCategories.createdAt)),
    db
      .select({ id: menuItems.id, categoryId: menuItems.categoryId, name: menuItems.name, description: menuItems.description, priceCents: menuItems.priceCents, tags: menuItems.tags, photoUrl: menuItems.photoUrl, available: menuItems.available, position: menuItems.position })
      .from(menuItems)
      .where(and(eq(menuItems.businessId, businessId), opts.onlyAvailable ? eq(menuItems.available, true) : undefined))
      .orderBy(asc(menuItems.position), asc(menuItems.createdAt)),
  ]);
  return { categories: cats as MenuCategoryView[], items: items as MenuItemView[] };
}

/** Table publique (QR) : active, établissement ni supprimé ni en pause. */
export async function tableByToken(token: string) {
  if (!/^[\w-]{10,40}$/.test(token)) return null;
  const [row] = await db
    .select({ table: diningTables, business: { id: businesses.id, name: businesses.name, timezone: businesses.timezone, photoUrl: businesses.photoUrl } })
    .from(diningTables)
    .innerJoin(businesses, eq(businesses.id, diningTables.businessId))
    .where(and(eq(diningTables.token, token), eq(diningTables.active, true), isNull(businesses.deletedAt), isNull(businesses.pausedAt)));
  return row ?? null;
}

/** Commandes des dernières 24 heures (tableau de la cuisine). */
export async function recentOrders(businessId: string) {
  const since = new Date(Date.now() - 24 * 3600_000);
  return db.select().from(tableOrders).where(and(eq(tableOrders.businessId, businessId), gte(tableOrders.createdAt, since))).orderBy(desc(tableOrders.createdAt)).limit(300);
}

export async function tablesOf(businessId: string) {
  return db.select().from(diningTables).where(eq(diningTables.businessId, businessId)).orderBy(asc(diningTables.position), asc(diningTables.createdAt));
}

/** Adresse publique des QR codes (le site Skydev). */
export const tableOrigin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");

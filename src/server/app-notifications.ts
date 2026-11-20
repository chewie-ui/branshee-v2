import "server-only";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { appNotifications, businesses } from "@/db/schema";

export type AppNotification = { id: string; kind: string; title: string; body: string; url: string | null; read: boolean; at: string };

/**
 * Enregistre une notification pour l'espace pro de chaque utilisateur (cloche, bulle, notification de l'ordinateur, son).
 * Ne fait jamais échouer l'action qui l'a déclenchée.
 */
export async function recordAppNotifications(userIds: string[], n: { kind: string; title: string; body: string; url?: string | null; businessId?: string | null }) {
  try {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return;
    await db.insert(appNotifications).values(ids.map((userId) => ({ userId, kind: n.kind, title: n.title, body: n.body, url: n.url ?? null, businessId: n.businessId ?? null })));
  } catch (e) {
    console.error("[app-notifications]", e instanceof Error ? e.message : e);
  }
}

/** Propriétaire d'un établissement (pour les alertes boutique et messages du site). */
export async function ownerOf(businessId: string) {
  const [b] = await db.select({ ownerId: businesses.ownerId }).from(businesses).where(eq(businesses.id, businessId));
  return b?.ownerId ?? null;
}

/** Dernières notifications d'un utilisateur (les plus récentes d'abord) et nombre de non lues. `after` : seulement les plus récentes. */
export async function appNotificationsOf(userId: string, after?: Date | null): Promise<{ items: AppNotification[]; unread: number }> {
  const rows = await db
    .select()
    .from(appNotifications)
    .where(after ? and(eq(appNotifications.userId, userId), gt(appNotifications.createdAt, after)) : eq(appNotifications.userId, userId))
    .orderBy(desc(appNotifications.createdAt))
    .limit(30);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(appNotifications).where(and(eq(appNotifications.userId, userId), isNull(appNotifications.readAt)));
  return { items: rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, url: r.url, read: !!r.readAt, at: r.createdAt.toISOString() })), unread: n };
}

export async function markAllAppNotificationsRead(userId: string) {
  await db.update(appNotifications).set({ readAt: new Date() }).where(and(eq(appNotifications.userId, userId), isNull(appNotifications.readAt)));
}

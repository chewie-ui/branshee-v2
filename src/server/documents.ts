import "server-only";
import { and, asc, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, docFolders, documents, members } from "@/db/schema";
import type { AppContext } from "@/server/context";

export const QUOTA_BYTES = 2 * 1024 ** 3;
export const MAX_FILE = 10 * 1024 * 1024;
export const docRights = (ctx: AppContext) => ({ manage: ctx.member.isOwner || ctx.can("settings.manage") });
export const docOrigin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");

export async function folderPath(businessId: string, folderId: string | null) {
  const path: { id: string; name: string }[] = [];
  let cur = folderId;
  for (let i = 0; cur && i < 20; i++) {
    const [f] = await db.select({ id: docFolders.id, name: docFolders.name, parentId: docFolders.parentId }).from(docFolders).where(and(eq(docFolders.id, cur), eq(docFolders.businessId, businessId)));
    if (!f) return null;
    path.unshift({ id: f.id, name: f.name });
    cur = f.parentId;
  }
  return path;
}

export async function folderContent(businessId: string, folderId: string | null) {
  const [folders, files] = await Promise.all([
    db
      .select({ id: docFolders.id, name: docFolders.name, customer: customers.fullName, count: sql<number>`(select count(*)::int from documents d where d.folder_id = "doc_folders"."id")` })
      .from(docFolders)
      .leftJoin(customers, eq(customers.id, docFolders.customerId))
      .where(and(eq(docFolders.businessId, businessId), folderId ? eq(docFolders.parentId, folderId) : isNull(docFolders.parentId)))
      .orderBy(asc(docFolders.name)),
    db
      .select({ id: documents.id, name: documents.name, mime: documents.mime, size: documents.sizeBytes, createdAt: documents.createdAt, by: members.displayName, uploadedById: documents.uploadedById, shareToken: documents.shareToken, shareExpiresAt: documents.shareExpiresAt, customer: customers.fullName, customerId: documents.customerId })
      .from(documents)
      .leftJoin(members, eq(members.id, documents.uploadedById))
      .leftJoin(customers, eq(customers.id, documents.customerId))
      .where(and(eq(documents.businessId, businessId), folderId ? eq(documents.folderId, folderId) : isNull(documents.folderId)))
      .orderBy(desc(documents.createdAt))
      .limit(1000),
  ]);
  return { folders, files };
}

export async function searchDocuments(businessId: string, q: string) {
  return db
    .select({ id: documents.id, name: documents.name, mime: documents.mime, size: documents.sizeBytes, createdAt: documents.createdAt, by: members.displayName, uploadedById: documents.uploadedById, shareToken: documents.shareToken, shareExpiresAt: documents.shareExpiresAt, customer: customers.fullName, customerId: documents.customerId, folder: docFolders.name })
    .from(documents)
    .leftJoin(members, eq(members.id, documents.uploadedById))
    .leftJoin(customers, eq(customers.id, documents.customerId))
    .leftJoin(docFolders, eq(docFolders.id, documents.folderId))
    .where(and(eq(documents.businessId, businessId), ilike(documents.name, `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`)))
    .orderBy(desc(documents.createdAt))
    .limit(200);
}

export async function usedBytes(businessId: string) {
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${documents.sizeBytes}), 0)::bigint` }).from(documents).where(eq(documents.businessId, businessId));
  return Number(r?.n ?? 0);
}

export async function allFolders(businessId: string) {
  return db.select({ id: docFolders.id, name: docFolders.name, parentId: docFolders.parentId }).from(docFolders).where(eq(docFolders.businessId, businessId)).orderBy(asc(docFolders.name)).limit(2000);
}

/** Types affichés dans le navigateur ; tout le reste est téléchargé (jamais exécuté). */
export const INLINE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "text/plain"]);

import "server-only";
import { headers } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, documents } from "@/db/schema";
import { createFolder, deleteDocument, deleteFolder, moveDocument, renameDocument, renameFolder, shareDocument, unshareDocument, uploadDocument } from "@/server/actions/documents";
import { fail, forbidden, has, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { fileResponse } from "@/server/document-response";
import { QUOTA_BYTES, allFolders, docOrigin, docRights, folderContent, folderPath, searchDocuments, usedBytes } from "@/server/documents";
import { isLocked } from "@/server/plan";

/** API mobile de l'app Documents (Skydev) : dossiers, fichiers chiffrés, envoi, partage, recherche. */

async function needDocs(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("documents")) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const idOrNull = (v: unknown) => (uuid(v) ? (v as string) : null);
const ok = <T extends { ok: boolean }>(r: T) => {
  const e = r as { ok: boolean; error?: string };
  if (!e.ok) return invalid(e.error ?? "Action impossible.");
  return r as T & { id?: string; message?: string; url?: string };
};

async function browse(r: ApiRequest) {
  const ctx = await needDocs();
  const folderId = idOrNull(r.query.get("folderId"));
  const path = await folderPath(ctx.business.id, folderId);
  if (!path) return fail(404, "not_found", "Dossier introuvable.");
  const q = (r.query.get("q") ?? "").trim().slice(0, 100);
  const [content, found, used, folders, clients] = await Promise.all([
    q ? Promise.resolve({ folders: [], files: [] }) : folderContent(ctx.business.id, folderId),
    q ? searchDocuments(ctx.business.id, q) : Promise.resolve(null),
    usedBytes(ctx.business.id),
    allFolders(ctx.business.id),
    ctx.can("customers.view") ? db.select({ id: customers.id, name: customers.fullName }).from(customers).where(eq(customers.businessId, ctx.business.id)).orderBy(asc(customers.fullName)).limit(3000) : Promise.resolve([]),
  ]);
  const origin = docOrigin();
  const files = (found ?? content.files).map((f) => {
    const active = !!f.shareToken && !!f.shareExpiresAt && f.shareExpiresAt > new Date();
    return {
      id: f.id,
      name: f.name,
      mime: f.mime,
      size: f.size,
      createdAt: f.createdAt.toISOString(),
      by: f.by,
      uploadedById: f.uploadedById,
      customer: f.customer,
      customerId: f.customerId,
      folder: "folder" in f ? (f.folder as string | null) : null,
      share: active ? { url: `${origin}/partage/${f.shareToken}`, expiresAt: f.shareExpiresAt!.toISOString() } : null,
    };
  });
  return { folderId, path, q, folders: content.folders, files, allFolders: folders, clients, me: ctx.member.id, canManage: docRights(ctx).manage, usedBytes: used, quotaBytes: QUOTA_BYTES };
}

async function ownDoc(ctx: AppContext, id: string) {
  if (!uuid(id)) return null;
  const [d] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.businessId, ctx.business.id)));
  return d ?? null;
}

export const documentsRoutes: Route[] = [
  { method: "GET", path: "/documents", handler: browse },
  {
    method: "POST",
    path: "/documents",
    handler: async (r) => {
      await needDocs();
      if (!(r.raw.headers.get("content-type") ?? "").includes("multipart/form-data")) return invalid("Choisissez un fichier.");
      const fd = await r.raw.formData().catch(() => invalid("Envoi illisible."));
      const res = ok(await uploadDocument(fd));
      return { ok: true, id: res.id ?? null, message: res.message };
    },
  },
  {
    method: "PATCH",
    path: "/documents/:id",
    handler: async (r) => {
      await needDocs();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Fichier introuvable.");
      if (has(r.body, "name")) ok(await renameDocument(r.params.id!, str(r.body.name, 200)));
      if (has(r.body, "folderId")) ok(await moveDocument(r.params.id!, idOrNull(r.body.folderId)));
      return { ok: true };
    },
  },
  {
    method: "DELETE",
    path: "/documents/:id",
    handler: async (r) => {
      await needDocs();
      ok(await deleteDocument(str(r.params.id, 40)));
      return { ok: true };
    },
  },
  {
    method: "POST",
    path: "/documents/:id/share",
    handler: async (r) => {
      await needDocs();
      const res = ok(await shareDocument(str(r.params.id, 40), Number(r.body.days) || 7));
      return { ok: true, url: res.url ?? null, message: res.message };
    },
  },
  {
    method: "DELETE",
    path: "/documents/:id/share",
    handler: async (r) => {
      await needDocs();
      ok(await unshareDocument(str(r.params.id, 40)));
      return { ok: true };
    },
  },
  {
    method: "GET",
    path: "/documents/:id/file",
    handler: async (r) => {
      const ctx = await needDocs();
      const d = await ownDoc(ctx, r.params.id!);
      if (!d) return fail(404, "not_found", "Fichier introuvable.");
      return fileResponse(d, r.query.has("download"));
    },
  },
  {
    method: "POST",
    path: "/documents/folders",
    handler: async (r) => {
      await needDocs();
      const res = ok(await createFolder({ name: str(r.body.name, 80), parentId: idOrNull(r.body.parentId), customerId: idOrNull(r.body.customerId) }));
      return { ok: true, id: res.id ?? null };
    },
  },
  {
    method: "PATCH",
    path: "/documents/folders/:id",
    handler: async (r) => {
      await needDocs();
      ok(await renameFolder(str(r.params.id, 40), str(r.body.name, 80)));
      return { ok: true };
    },
  },
  {
    method: "DELETE",
    path: "/documents/folders/:id",
    handler: async (r) => {
      await needDocs();
      const res = ok(await deleteFolder(str(r.params.id, 40)));
      return { ok: true, message: res.message };
    },
  },
];

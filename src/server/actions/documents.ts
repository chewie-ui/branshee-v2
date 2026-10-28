"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers, docFolders, documents } from "@/db/schema";
import { requireContext, type AppContext } from "@/server/context";
import { MAX_FILE, QUOTA_BYTES, docOrigin, docRights } from "@/server/documents";
import { deletePrivateFile, isPdf, savePrivateFile, sniffImage } from "@/server/storage";

type Result = { ok: true; message?: string; id?: string; url?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const refresh = () => revalidatePath("/app/documents", "layout");
const uuidOrNull = z.union([z.literal(""), z.null(), z.uuid()]).transform((v) => v || null);

async function member(): Promise<{ ctx: AppContext; error: null } | { ctx: AppContext; error: { ok: false; error: string } }> {
  const ctx = await requireContext();
  return ctx.impersonating ? { ctx, error: SUPERVISION } : { ctx, error: null };
}
async function ownFolder(businessId: string, id: string | null) {
  if (!id) return true;
  const [f] = await db.select({ id: docFolders.id }).from(docFolders).where(and(eq(docFolders.id, id), eq(docFolders.businessId, businessId)));
  return !!f;
}
async function ownCustomer(businessId: string, id: string | null) {
  if (!id) return true;
  const [c] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, id), eq(customers.businessId, businessId)));
  return !!c;
}

export async function createFolder(input: { name: string; parentId: string | null; customerId?: string | null }): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  const v = z.object({ name: z.string().trim().min(1, "Donnez un nom au dossier.").max(80), parentId: uuidOrNull, customerId: uuidOrNull.optional() }).safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Nom invalide." };
  if (!(await ownFolder(ctx.business.id, v.data.parentId)) || !(await ownCustomer(ctx.business.id, v.data.customerId ?? null))) return { ok: false, error: "Dossier introuvable." };
  const [row] = await db.insert(docFolders).values({ businessId: ctx.business.id, name: v.data.name, parentId: v.data.parentId, customerId: v.data.customerId ?? null }).returning({ id: docFolders.id });
  refresh();
  return { ok: true, message: "Dossier créé.", id: row!.id };
}

export async function renameFolder(id: string, name: string): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  const v = z.string().trim().min(1).max(80).safeParse(name);
  if (!v.success || !z.uuid().safeParse(id).success) return { ok: false, error: "Nom invalide." };
  await db.update(docFolders).set({ name: v.data }).where(and(eq(docFolders.id, id), eq(docFolders.businessId, ctx.business.id)));
  refresh();
  return { ok: true, message: "Dossier renommé." };
}

/** Supprimer un dossier et tout son contenu (responsable seulement). Les fichiers chiffrés sont effacés du disque. */
export async function deleteFolder(id: string): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  if (!docRights(ctx).manage) return { ok: false, error: "Seul le responsable peut supprimer un dossier." };
  if (!z.uuid().safeParse(id).success || !(await ownFolder(ctx.business.id, id))) return { ok: false, error: "Dossier introuvable." };
  const tree = await db.execute<{ id: string }>(sql`with recursive t as (select id from doc_folders where id = ${id} and business_id = ${ctx.business.id} union all select f.id from doc_folders f join t on f.parent_id = t.id) select id from t`);
  const ids = [...tree].map((r) => r.id);
  const files = ids.length ? await db.select({ ref: documents.fileRef }).from(documents).where(and(eq(documents.businessId, ctx.business.id), inArray(documents.folderId, ids))) : [];
  await db.delete(docFolders).where(and(eq(docFolders.id, id), eq(docFolders.businessId, ctx.business.id)));
  for (const f of files) await deletePrivateFile(f.ref).catch(() => {});
  refresh();
  return { ok: true, message: `Dossier supprimé${files.length ? ` avec ${files.length} fichier${files.length > 1 ? "s" : ""}` : ""}.` };
}

/** Envoi d'un fichier (10 Mo max), chiffré sur le serveur. Quota : 2 Go par entreprise. */
export async function uploadDocument(fd: FormData): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choisissez un fichier." };
  if (file.size > MAX_FILE) return { ok: false, error: `« ${file.name} » dépasse 10 Mo.` };
  const folderId = uuidOrNull.safeParse(fd.get("folderId") ?? "");
  const customerId = uuidOrNull.safeParse(fd.get("customerId") ?? "");
  if (!folderId.success || !customerId.success || !(await ownFolder(ctx.business.id, folderId.data)) || !(await ownCustomer(ctx.business.id, customerId.data))) return { ok: false, error: "Dossier introuvable." };
  const data = Buffer.from(await file.arrayBuffer());
  // Le type vient du contenu (pas du nom) pour les PDF et images ; le reste est servi en téléchargement.
  const mime = isPdf(data) ? "application/pdf" : (sniffImage(data) ?? (/\.txt$/i.test(file.name) ? "text/plain" : "application/octet-stream"));
  const name = file.name.replace(/[\u0000-\u001f/\\]+/g, "_").slice(0, 200) || "fichier";
  const ref = await savePrivateFile(data);
  // Quota vérifié sous verrou : des envois en parallèle ne peuvent pas dépasser 2 Go.
  const row = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${ctx.business.id}:documents`}))`);
    const [u] = await tx.select({ n: sql<number>`coalesce(sum(${documents.sizeBytes}), 0)::bigint` }).from(documents).where(eq(documents.businessId, ctx.business.id));
    if (Number(u?.n ?? 0) + file.size > QUOTA_BYTES) return null;
    const [r] = await tx.insert(documents).values({ businessId: ctx.business.id, folderId: folderId.data, name, mime, sizeBytes: file.size, fileRef: ref, uploadedById: ctx.member.id, customerId: customerId.data }).returning({ id: documents.id });
    return r!;
  });
  if (!row) {
    await deletePrivateFile(ref).catch(() => {});
    return { ok: false, error: "Espace plein (2 Go) : supprimez d'anciens fichiers." };
  }
  refresh();
  return { ok: true, message: `« ${name} » ajouté.`, id: row.id };
}

async function ownDoc(ctx: AppContext, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [d] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.businessId, ctx.business.id)));
  return d ?? null;
}
const canTouch = (ctx: AppContext, d: { uploadedById: string | null }) => docRights(ctx).manage || d.uploadedById === ctx.member.id;

export async function renameDocument(id: string, name: string): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  const d = await ownDoc(ctx, id);
  const v = z.string().trim().min(1).max(200).safeParse(name);
  if (!d || !v.success) return { ok: false, error: "Nom invalide." };
  if (!canTouch(ctx, d)) return { ok: false, error: "Seul le responsable ou la personne qui l'a ajouté peut le renommer." };
  await db.update(documents).set({ name: v.data.replace(/[\u0000-\u001f/\\]+/g, "_") }).where(eq(documents.id, d.id));
  refresh();
  return { ok: true, message: "Fichier renommé." };
}

export async function moveDocument(id: string, folderId: string | null): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  const d = await ownDoc(ctx, id);
  const f = uuidOrNull.safeParse(folderId);
  if (!d || !f.success || !(await ownFolder(ctx.business.id, f.data))) return { ok: false, error: "Dossier introuvable." };
  await db.update(documents).set({ folderId: f.data }).where(eq(documents.id, d.id));
  refresh();
  return { ok: true, message: "Fichier déplacé." };
}

export async function deleteDocument(id: string): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  const d = await ownDoc(ctx, id);
  if (!d) return { ok: false, error: "Fichier introuvable." };
  if (!canTouch(ctx, d)) return { ok: false, error: "Seul le responsable ou la personne qui l'a ajouté peut le supprimer." };
  await db.delete(documents).where(eq(documents.id, d.id));
  await deletePrivateFile(d.fileRef).catch(() => {});
  refresh();
  return { ok: true, message: "Fichier supprimé." };
}

/** Lien de partage (téléchargement sans compte) valable quelques jours, révocable. */
export async function shareDocument(id: string, days: number): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  const d = await ownDoc(ctx, id);
  if (!d) return { ok: false, error: "Fichier introuvable." };
  if (!canTouch(ctx, d)) return { ok: false, error: "Seul le responsable ou la personne qui l'a ajouté peut le partager." };
  if (![1, 7, 30].includes(days)) return { ok: false, error: "Durée invalide." };
  const token = randomBytes(18).toString("base64url");
  await db.update(documents).set({ shareToken: token, shareExpiresAt: new Date(Date.now() + days * 86400_000) }).where(eq(documents.id, d.id));
  refresh();
  return { ok: true, message: `Lien créé, valable ${days === 1 ? "24 heures" : `${days} jours`}.`, url: `${docOrigin()}/partage/${token}` };
}

export async function unshareDocument(id: string): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  const d = await ownDoc(ctx, id);
  if (!d) return { ok: false, error: "Fichier introuvable." };
  if (!canTouch(ctx, d)) return { ok: false, error: "Action réservée." };
  await db.update(documents).set({ shareToken: null, shareExpiresAt: null }).where(eq(documents.id, d.id));
  refresh();
  return { ok: true, message: "Lien de partage désactivé." };
}

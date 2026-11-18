"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { careDocuments, customers, members } from "@/db/schema";
import { encrypt } from "@/lib/field-crypto";
import { isCareDocKind } from "@/lib/care-team";
import { requireContext } from "@/server/context";
import { buildDocument } from "@/server/care-documents";
import { episodeOf, logRecordAccess } from "@/server/physio";

type Result = { ok: true; message: string; key?: string } | { ok: false; error: string };
const RO = { ok: false as const, error: "Mode supervision : lecture seule." };

/** Nouveau document INAMI pré-rempli depuis le dossier (brouillon modifiable). */
export async function createCareDocument(customerId: string, kind: string, episodeId: string | null): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  if (!z.uuid().safeParse(customerId).success || !isCareDocKind(kind)) return { ok: false, error: "Document inconnu." };
  const [c] = await db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.businessId, ctx.business.id)));
  if (!c) return { ok: false, error: "Fiche introuvable." };
  const e = episodeId && z.uuid().safeParse(episodeId).success ? await episodeOf(ctx.business.id, episodeId) : null;
  if (episodeId && (!e || e.customerId !== c.id)) return { ok: false, error: "Épisode introuvable." };
  const [me] = await db.select({ inami: members.inami }).from(members).where(eq(members.id, ctx.member.id));
  const d = await buildDocument(kind, c, e, ctx.user.name, me?.inami ?? null);
  const key = randomUUID();
  await db.insert(careDocuments).values({ businessId: ctx.business.id, customerId: c.id, episodeId: e?.id ?? null, docKey: key, version: 1, kind, title: d.title, recipientName: d.recipientName, recipientInami: d.recipientInami, contentEnc: encrypt(d.content), authorUserId: ctx.user.id, authorName: ctx.user.name });
  await logRecordAccess(ctx, c.id, "edit", `Document créé : ${d.title}`);
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true, message: "Brouillon créé : relisez et complétez-le.", key };
}

const saveSchema = z.object({
  title: z.string().trim().min(2, "Donnez un titre.").max(160),
  recipientName: z.string().trim().max(160).optional().transform((v) => (v ? v : null)),
  recipientInami: z.string().trim().max(20).optional().transform((v) => (v ? v : null)),
  content: z.string().trim().min(1, "Le document est vide.").max(40000),
});

async function latest(businessId: string, key: string) {
  const [d] = await db.select().from(careDocuments).where(and(eq(careDocuments.businessId, businessId), eq(careDocuments.docKey, key))).orderBy(desc(careDocuments.version)).limit(1);
  return d ?? null;
}

/**
 * Enregistre un document. Un brouillon est modifié tel quel ; un document validé est verrouillé :
 * l'enregistrer crée une nouvelle version (brouillon), l'ancienne reste intacte.
 */
export async function saveCareDocument(docKey: string, input: unknown): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  if (!z.uuid().safeParse(docKey).success) return { ok: false, error: "Document introuvable." };
  const v = saveSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez le document." };
  let created = false;
  let customerId = "";
  const ok = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"care-doc:" + docKey}))`);
    const [d] = await tx.select().from(careDocuments).where(and(eq(careDocuments.businessId, ctx.business.id), eq(careDocuments.docKey, docKey))).orderBy(desc(careDocuments.version)).limit(1);
    if (!d) return false;
    customerId = d.customerId;
    const values = { title: v.data.title, recipientName: v.data.recipientName, recipientInami: v.data.recipientInami, contentEnc: encrypt(v.data.content), authorUserId: ctx.user.id, authorName: ctx.user.name, updatedAt: new Date() };
    if (d.status === "draft") await tx.update(careDocuments).set(values).where(eq(careDocuments.id, d.id));
    else {
      created = true;
      await tx.insert(careDocuments).values({ businessId: d.businessId, customerId: d.customerId, episodeId: d.episodeId, docKey, version: d.version + 1, kind: d.kind, ...values });
    }
    return true;
  });
  if (!ok) return { ok: false, error: "Document introuvable." };
  await logRecordAccess(ctx, customerId, "edit", `Document modifié : ${v.data.title}`);
  revalidatePath(`/app/clients/${customerId}`);
  return { ok: true, message: created ? "Nouvelle version créée (la version validée reste intacte)." : "Brouillon enregistré." };
}

/** Nouvelle version d'un document validé, à partir de son contenu (brouillon). */
export async function newCareDocumentVersion(docKey: string): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  if (!z.uuid().safeParse(docKey).success) return { ok: false, error: "Document introuvable." };
  const d = await latest(ctx.business.id, docKey);
  if (!d) return { ok: false, error: "Document introuvable." };
  if (d.status === "draft") return { ok: true, message: "Un brouillon est déjà en cours." };
  await db.insert(careDocuments).values({ businessId: d.businessId, customerId: d.customerId, episodeId: d.episodeId, docKey, version: d.version + 1, kind: d.kind, title: d.title, recipientName: d.recipientName, recipientInami: d.recipientInami, contentEnc: d.contentEnc, authorUserId: ctx.user.id, authorName: ctx.user.name });
  revalidatePath(`/app/clients/${d.customerId}`);
  return { ok: true, message: `Version ${d.version + 1} créée en brouillon.` };
}

/** Valide le document : il est verrouillé (impression ou envoi = validation). */
export async function validateCareDocument(docKey: string): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  if (!z.uuid().safeParse(docKey).success) return { ok: false, error: "Document introuvable." };
  const d = await latest(ctx.business.id, docKey);
  if (!d) return { ok: false, error: "Document introuvable." };
  if (d.status === "validated") return { ok: true, message: "Déjà validé." };
  await db.update(careDocuments).set({ status: "validated", validatedAt: new Date(), updatedAt: new Date() }).where(eq(careDocuments.id, d.id));
  await logRecordAccess(ctx, d.customerId, "edit", `Document validé : ${d.title} (v${d.version})`);
  revalidatePath(`/app/clients/${d.customerId}`);
  return { ok: true, message: "Document validé et verrouillé." };
}

/** Supprime un brouillon jamais validé (version 1 seulement : l'historique d'un document validé reste). */
export async function deleteCareDocumentDraft(docKey: string): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  if (!z.uuid().safeParse(docKey).success) return { ok: false, error: "Document introuvable." };
  const d = await latest(ctx.business.id, docKey);
  if (!d || d.status !== "draft") return { ok: false, error: "Seul un brouillon peut être supprimé." };
  await db.delete(careDocuments).where(eq(careDocuments.id, d.id));
  await logRecordAccess(ctx, d.customerId, "edit", `Brouillon supprimé : ${d.title}`);
  revalidatePath(`/app/clients/${d.customerId}`);
  return { ok: true, message: d.version > 1 ? "Brouillon supprimé : la version validée précédente reste." : "Brouillon supprimé." };
}

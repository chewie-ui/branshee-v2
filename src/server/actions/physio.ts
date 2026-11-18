"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, businesses, careEntries, careEpisodes, customers } from "@/db/schema";
import { blindIndex, encrypt } from "@/lib/field-crypto";
import { nissFacts, normalizeNiss, validNiss } from "@/lib/niss";
import { requireContext, type AppContext } from "@/server/context";
import { canReadEntry, episodeOf, isCareSection, logRecordAccess } from "@/server/physio";

type Result = { ok: true; message: string; id?: string } | { ok: false; error: string };
const RO = { ok: false as const, error: "Mode supervision : lecture seule." };
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

async function ownCustomer(ctx: AppContext, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [c] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.businessId, ctx.business.id)));
  return c ?? null;
}

const identitySchema = z.object({
  niss: z.string().trim().max(20).optional(),
  birthDate: isoDate.optional().or(z.literal("")),
  sex: z.enum(["", "M", "F", "X"]).optional(),
  mutuality: opt(80),
  mutualityNumber: opt(40),
  prescriberName: opt(120),
  prescriberInami: opt(20),
  gpName: opt(120),
  gpInami: opt(20),
  ct1: z.string().trim().regex(/^\d{0,3}$/, "CT1 : 3 chiffres.").optional().transform((v) => (v ? v : null)),
  ct2: z.string().trim().regex(/^\d{0,3}$/, "CT2 : 3 chiffres.").optional().transform((v) => (v ? v : null)),
  language: z.enum(["", "fr", "nl", "de", "en"]).optional().transform((v) => (v ? v : null)),
});

/** Identité du patient (dossier de soins) : NISS chiffré, unique dans l'établissement, date de naissance, mutuelle, médecins. */
export async function savePatientIdentity(customerId: string, input: unknown): Promise<Result> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  const c = await ownCustomer(ctx, customerId);
  if (!c) return { ok: false, error: "Fiche introuvable." };
  const v = identitySchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  let nissEnc: string | null = null;
  let nissHash: string | null = null;
  let birthDate = d.birthDate || null;
  let sex = d.sex || null;
  if (d.niss?.trim()) {
    const n = normalizeNiss(d.niss);
    if (!n || !validNiss(n)) return { ok: false, error: "Numéro national (NISS) invalide : 11 chiffres, clé de contrôle incorrecte." };
    nissHash = blindIndex(n, "niss");
    const [dup] = await db.select({ id: customers.id, name: customers.fullName }).from(customers).where(and(eq(customers.businessId, ctx.business.id), eq(customers.nissHash, nissHash), ne(customers.id, c.id)));
    if (dup) return { ok: false, error: `Ce NISS est déjà sur la fiche de ${dup.name} : fusionnez les deux fiches plutôt que d'en garder deux.` };
    nissEnc = encrypt(n);
    const f = nissFacts(n);
    birthDate = birthDate ?? f.birthDate;
    sex = sex ?? f.sex;
  }
  await db
    .update(customers)
    .set({ nissEnc, nissHash, birthDate, sex, mutuality: d.mutuality, mutualityNumber: d.mutualityNumber, prescriberName: d.prescriberName, prescriberInami: d.prescriberInami, gpName: d.gpName, gpInami: d.gpInami, ct1: d.ct1, ct2: d.ct2, language: d.language, updatedAt: new Date() })
    .where(eq(customers.id, c.id));
  await logRecordAccess(ctx, c.id, "edit", "Identité patient");
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "customer.identity", description: `Identité patient modifiée : ${c.fullName}` });
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true, message: "Identité enregistrée." };
}

/** Archiver / réactiver un dossier (jamais supprimé, toujours consultable). */
export async function setArchived(customerId: string, archived: boolean): Promise<Result> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  const c = await ownCustomer(ctx, customerId);
  if (!c) return { ok: false, error: "Fiche introuvable." };
  await db.update(customers).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() }).where(eq(customers.id, c.id));
  await logRecordAccess(ctx, c.id, "edit", archived ? "Dossier archivé" : "Dossier réactivé");
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true, message: archived ? "Dossier archivé : il reste consultable et réactivable." : "Dossier réactivé." };
}

const episodeSchema = z.object({
  title: z.string().trim().min(2, "Donnez un intitulé (ex. Entorse cheville droite).").max(120),
  prescriberName: opt(120),
  prescriberInami: opt(20),
  prescriptionDate: isoDate.optional().or(z.literal("")),
  sessionsPrescribed: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(500).nullable()),
  pathologyKind: z.enum(["courante", "E", "Fa", "Fb", "autre"]),
  nomenclature: opt(60),
  approvalStart: isoDate.optional().or(z.literal("")),
  approvalEnd: isoDate.optional().or(z.literal("")),
});

/** Nouvel épisode de soins (une prescription) ou modification de ses données administratives. */
export async function saveEpisode(customerId: string, episodeId: string | null, input: unknown): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  const c = await ownCustomer(ctx, customerId);
  if (!c) return { ok: false, error: "Fiche introuvable." };
  const v = episodeSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  if (d.approvalStart && d.approvalEnd && d.approvalEnd < d.approvalStart) return { ok: false, error: "La fin de l'accord est avant son début." };
  const values = { title: d.title, prescriberName: d.prescriberName ?? c.prescriberName, prescriberInami: d.prescriberInami ?? c.prescriberInami, prescriptionDate: d.prescriptionDate || null, sessionsPrescribed: d.sessionsPrescribed, pathologyKind: d.pathologyKind, nomenclature: d.nomenclature, approvalStart: d.approvalStart || null, approvalEnd: d.approvalEnd || null, updatedAt: new Date() };
  let id = episodeId;
  if (episodeId) {
    const e = await episodeOf(ctx.business.id, episodeId);
    if (!e || e.customerId !== c.id) return { ok: false, error: "Épisode introuvable." };
    await db.update(careEpisodes).set(values).where(eq(careEpisodes.id, e.id));
  } else {
    const [row] = await db.insert(careEpisodes).values({ businessId: ctx.business.id, customerId: c.id, createdById: ctx.user.id, ...values }).returning({ id: careEpisodes.id });
    id = row!.id;
  }
  await logRecordAccess(ctx, c.id, "edit", `Épisode « ${d.title} »`);
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true, message: episodeId ? "Épisode mis à jour." : "Épisode de soins créé.", id: id! };
}

/** Clôturer ou rouvrir un épisode. */
export async function setEpisodeClosed(episodeId: string, closed: boolean): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  const e = z.uuid().safeParse(episodeId).success ? await episodeOf(ctx.business.id, episodeId) : null;
  if (!e) return { ok: false, error: "Épisode introuvable." };
  await db.update(careEpisodes).set({ status: closed ? "closed" : "open", closedAt: closed ? new Date() : null, updatedAt: new Date() }).where(eq(careEpisodes.id, e.id));
  await logRecordAccess(ctx, e.customerId, "edit", closed ? `Épisode clôturé : ${e.title}` : `Épisode rouvert : ${e.title}`);
  revalidatePath(`/app/clients/${e.customerId}/episodes/${e.id}`);
  return { ok: true, message: closed ? "Épisode clôturé." : "Épisode rouvert." };
}

const entrySchema = z.object({
  section: z.string(),
  content: z.string().trim().min(1, "Le contenu est vide.").max(20000),
  date: isoDate.optional().or(z.literal("")),
  confidential: z.boolean().optional(),
  passive: z.boolean().optional(),
});

/**
 * Ajoute ou modifie une donnée du dossier kiné. Jamais d'écrasement : chaque modification ajoute une version
 * (auteur, date), l'historique complet reste consultable.
 */
export async function saveCareEntry(episodeId: string, entryKey: string | null, input: unknown): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  const e = z.uuid().safeParse(episodeId).success ? await episodeOf(ctx.business.id, episodeId) : null;
  if (!e) return { ok: false, error: "Épisode introuvable." };
  const v = entrySchema.safeParse(input);
  if (!v.success || !isCareSection(v.data.section)) return { ok: false, error: v.success ? "Section inconnue." : (v.error.issues[0]?.message ?? "Contenu invalide.") };
  const key = entryKey && z.uuid().safeParse(entryKey).success ? entryKey : randomUUID();
  if (entryKey && !(await canReadEntry(key, ctx.user.id))) return { ok: false, error: "Donnée confidentielle : seul son auteur peut la modifier." };
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"care-entry:" + key}))`);
    const [last] = await tx.select({ version: careEntries.version, section: careEntries.section, episodeId: careEntries.episodeId }).from(careEntries).where(eq(careEntries.entryKey, key)).orderBy(desc(careEntries.version)).limit(1);
    if (last && (last.episodeId !== e.id || last.section !== v.data.section)) throw new Error("Donnée d'un autre dossier.");
    await tx.insert(careEntries).values({ businessId: ctx.business.id, episodeId: e.id, entryKey: key, section: v.data.section, version: (last?.version ?? 0) + 1, contentEnc: encrypt(v.data.content), entryDate: v.data.date || null, confidential: v.data.confidential ? 1 : 0, passive: v.data.passive ? 1 : 0, authorUserId: ctx.user.id, authorName: ctx.user.name });
  });
  await db.update(careEpisodes).set({ updatedAt: new Date() }).where(eq(careEpisodes.id, e.id));
  await logRecordAccess(ctx, e.customerId, "edit", `Dossier : ${v.data.section}`);
  revalidatePath(`/app/clients/${e.customerId}/episodes/${e.id}`);
  return { ok: true, message: entryKey ? "Modification enregistrée (nouvelle version)." : "Ajouté au dossier." };
}

/** Supprime une donnée : une version « supprimée » est ajoutée, l'historique reste en base. */
export async function deleteCareEntry(episodeId: string, entryKey: string): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  const e = z.uuid().safeParse(episodeId).success ? await episodeOf(ctx.business.id, episodeId) : null;
  if (!e || !z.uuid().safeParse(entryKey).success) return { ok: false, error: "Introuvable." };
  const [last] = await db.select().from(careEntries).where(and(eq(careEntries.entryKey, entryKey), eq(careEntries.episodeId, e.id))).orderBy(desc(careEntries.version)).limit(1);
  if (!last || last.deleted) return { ok: false, error: "Introuvable." };
  if (!(await canReadEntry(entryKey, ctx.user.id))) return { ok: false, error: "Donnée confidentielle : seul son auteur peut la supprimer." };
  await db.insert(careEntries).values({ businessId: ctx.business.id, episodeId: e.id, entryKey, section: last.section, version: last.version + 1, contentEnc: last.contentEnc, entryDate: last.entryDate, deleted: 1, confidential: last.confidential, passive: last.passive, authorUserId: ctx.user.id, authorName: ctx.user.name });
  await logRecordAccess(ctx, e.customerId, "edit", `Dossier : suppression (${last.section})`);
  revalidatePath(`/app/clients/${e.customerId}/episodes/${e.id}`);
  return { ok: true, message: "Supprimé du dossier (conservé dans l'historique)." };
}

/** Verrouillage de session après inactivité (minutes ; null = jamais). */
export async function saveAutoLock(minutes: number | null): Promise<Result> {
  const ctx = await requireContext("settings.manage", { write: true });
  if (minutes != null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 240)) return { ok: false, error: "Durée invalide." };
  await db.update(businesses).set({ autoLockMinutes: minutes }).where(eq(businesses.id, ctx.business.id));
  revalidatePath("/app");
  return { ok: true, message: minutes ? `Verrouillage après ${minutes} min d'inactivité.` : "Verrouillage automatique désactivé." };
}

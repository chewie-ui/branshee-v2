"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, appointments, customerNotes, customers } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/field-crypto";
import { clientWord } from "@/lib/terminology";
import { requireContext, type AppContext } from "@/server/context";
import { deletePrivateFile, isPdf, savePrivateFile } from "@/server/storage";

export type CustomerState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;

const MAX_PDF = 10 * 1024 * 1024;
const isUnique = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } };
  return err.code === "23505" || err.cause?.code === "23505";
};

async function ownCustomer(businessId: string, customerId: string) {
  const [c] = await db.select().from(customers).where(and(eq(customers.id, z.uuid().parse(customerId)), eq(customers.businessId, businessId)));
  return c ?? null;
}

async function log(ctx: AppContext, action: string, description: string) {
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action, description });
}

const fieldErrors = (issues: z.core.$ZodIssue[]) => {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
};

/* ───────────────────────────── Création manuelle ───────────────────────────── */

const newSchema = z
  .object({
    firstName: z.string().trim().max(60),
    lastName: z.string().trim().max(60),
    email: z.union([z.literal(""), z.email({ message: "Email invalide." })]),
    phone: z.string().trim().max(40),
  })
  .refine((v) => v.firstName.length + v.lastName.length > 0, { message: "Indiquez au moins un prénom ou un nom.", path: ["firstName"] });

/** Ajoute un client à la main : le nom suffit ; email et téléphone rattacheront ses futurs RDV. */
export async function createCustomer(_prev: CustomerState, fd: FormData): Promise<CustomerState> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const parsed = newSchema.safeParse({ firstName: g("firstName"), lastName: g("lastName"), email: g("email").toLowerCase(), phone: g("phone") });
  if (!parsed.success) return { error: "Vérifiez les champs indiqués.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const fullName = `${v.firstName} ${v.lastName}`.trim();
  let id: string;
  try {
    const [c] = await db
      .insert(customers)
      .values({ businessId: ctx.business.id, firstName: v.firstName || null, lastName: v.lastName || null, fullName, email: v.email || null, phone: v.phone || null, createdManually: true })
      .returning({ id: customers.id });
    id = c!.id;
  } catch (e) {
    if (isUnique(e)) return { error: "Vérifiez les champs indiqués.", fieldErrors: { email: `Un ${clientWord(ctx.business.businessType)} utilise déjà cet email.` } };
    throw e;
  }
  await log(ctx, "customer.create", `Fiche créée : ${fullName}`);
  redirect(`/app/clients/${id}`);
}

/* ───────────────────────────── Fiche ───────────────────────────── */

const contactSchema = z.object({
  firstName: z.string().trim().max(60),
  lastName: z.string().trim().max(60),
  email: z.union([z.literal(""), z.email({ message: "Email invalide." })]),
  phone: z.string().trim().max(40),
});

export async function saveContact(customerId: string, _prev: CustomerState, fd: FormData): Promise<CustomerState> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  const c = await ownCustomer(ctx.business.id, customerId);
  if (!c) return { error: "Fiche introuvable." };
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const parsed = contactSchema.safeParse({ firstName: g("firstName"), lastName: g("lastName"), email: g("email").toLowerCase(), phone: g("phone") });
  if (!parsed.success) return { error: "Vérifiez les champs indiqués.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const fullName = `${v.firstName} ${v.lastName}`.trim();
  if (!fullName) return { error: "Vérifiez les champs indiqués.", fieldErrors: { firstName: "Indiquez au moins un prénom ou un nom." } };
  try {
    await db.update(customers).set({ firstName: v.firstName || null, lastName: v.lastName || null, fullName, email: v.email || null, phone: v.phone || null }).where(eq(customers.id, c.id));
  } catch (e) {
    if (isUnique(e)) return { error: "Vérifiez les champs indiqués.", fieldErrors: { email: "Une autre fiche utilise déjà cet email. Fusionnez les deux fiches si c'est la même personne." } };
    throw e;
  }
  await log(ctx, "customer.update", `Coordonnées modifiées : ${fullName}`);
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true };
}

const altSchema = z.object({
  altName: z.string().trim().max(120),
  altEmail: z.union([z.literal(""), z.email({ message: "Email invalide." })]),
  altPhone: z.string().trim().max(40),
});

/** Contacts alternatifs : surnom ou nom de jeune fille, 2ᵉ email, 2ᵉ téléphone. */
export async function saveAltContacts(customerId: string, _prev: CustomerState, fd: FormData): Promise<CustomerState> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  const c = await ownCustomer(ctx.business.id, customerId);
  if (!c) return { error: "Fiche introuvable." };
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const parsed = altSchema.safeParse({ altName: g("altName"), altEmail: g("altEmail").toLowerCase(), altPhone: g("altPhone") });
  if (!parsed.success) return { error: "Vérifiez les champs indiqués.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  await db.update(customers).set({ altName: v.altName || null, altEmail: v.altEmail || null, altPhone: v.altPhone || null }).where(eq(customers.id, c.id));
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true };
}

/** Notes générales (allergies, préférences…) — chiffrées. */
export async function saveGeneralInfo(customerId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  const c = await ownCustomer(ctx.business.id, customerId);
  if (!c) return { ok: false, error: "Fiche introuvable." };
  await db.update(customers).set({ generalInfoEnc: encrypt(text.trim().slice(0, 5000)) }).where(eq(customers.id, c.id));
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true };
}

export async function setCustomerBlocked(customerId: string, blocked: boolean, reason: string): Promise<{ ok: boolean }> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  const c = await ownCustomer(ctx.business.id, customerId);
  if (!c) return { ok: false };
  await db.update(customers).set({ blockedAt: blocked ? new Date() : null, blockedReason: blocked ? reason.slice(0, 200) || null : null }).where(eq(customers.id, c.id));
  await log(ctx, blocked ? "customer.block" : "customer.unblock", `${blocked ? "Fiche bloquée" : "Fiche débloquée"} : ${c.fullName}`);
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true };
}

/** Supprime des fiches avec leur dossier et leurs rendez-vous (comme l'ancien « supprimer le client »). */
export async function deleteCustomers(rawIds: string[]): Promise<{ ok: boolean; deleted: number }> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  const ids = z.array(z.uuid()).min(1).max(500).parse(rawIds);
  const own = await db.select({ id: customers.id, name: customers.fullName }).from(customers).where(and(eq(customers.businessId, ctx.business.id), inArray(customers.id, ids)));
  if (!own.length) return { ok: false, deleted: 0 };
  const ownIds = own.map((c) => c.id);
  const files = await db.select({ path: customerNotes.attachmentPath }).from(customerNotes).where(inArray(customerNotes.customerId, ownIds));
  await db.transaction(async (tx) => {
    await tx.delete(appointments).where(and(eq(appointments.businessId, ctx.business.id), inArray(appointments.customerId, ownIds)));
    await tx.delete(customers).where(inArray(customers.id, ownIds));
  });
  for (const f of files) await deletePrivateFile(f.path);
  await log(ctx, "customer.delete", own.length === 1 ? `Fiche supprimée : ${own[0]!.name}` : `${own.length} fiches supprimées`);
  revalidatePath("/app", "layout");
  return { ok: true, deleted: own.length };
}

export async function deleteCustomerAndLeave(customerId: string) {
  await deleteCustomers([customerId]);
  redirect("/app/clients");
}

/**
 * Fusionne `sourceId` dans `targetId` : rendez-vous et notes passent sur la fiche gardée,
 * les coordonnées manquantes sont complétées, puis la fiche en double est supprimée.
 */
export async function mergeCustomers(targetId: string, sourceId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  if (targetId === sourceId) return { ok: false, error: "Choisissez une autre fiche." };
  const [target, source] = await Promise.all([ownCustomer(ctx.business.id, targetId), ownCustomer(ctx.business.id, sourceId)]);
  if (!target || !source) return { ok: false, error: "Fiche introuvable." };

  const info = [decrypt(target.generalInfoEnc), decrypt(source.generalInfoEnc)].filter(Boolean).join("\n\n");
  await db.transaction(async (tx) => {
    await tx.update(appointments).set({ customerId: target.id }).where(eq(appointments.customerId, source.id));
    await tx.update(customerNotes).set({ customerId: target.id }).where(eq(customerNotes.customerId, source.id));
    // L'email de la fiche supprimée peut devenir un contact alternatif.
    await tx.delete(customers).where(eq(customers.id, source.id));
    await tx
      .update(customers)
      .set({
        email: target.email ?? source.email,
        phone: target.phone ?? source.phone,
        userId: target.userId ?? source.userId,
        altName: target.altName ?? (source.fullName !== target.fullName ? source.fullName : source.altName),
        altEmail: target.altEmail ?? (target.email && source.email && source.email !== target.email ? source.email : source.altEmail),
        altPhone: target.altPhone ?? (target.phone && source.phone && source.phone !== target.phone ? source.phone : source.altPhone),
        generalInfoEnc: encrypt(info),
        blockedAt: target.blockedAt ?? source.blockedAt,
        blockedReason: target.blockedReason ?? source.blockedReason,
      })
      .where(eq(customers.id, target.id));
  });
  await log(ctx, "customer.merge", `Fiches fusionnées : ${source.fullName} → ${target.fullName}`);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Rattache un rendez-vous à une autre fiche (ex. réservation faite par un parent). */
export async function reassignAppointment(appointmentId: string, customerId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  const c = await ownCustomer(ctx.business.id, customerId);
  if (!c) return { ok: false, error: "Fiche introuvable." };
  const updated = await db
    .update(appointments)
    .set({ customerId: c.id, contactName: c.fullName, contactEmail: c.email, contactPhone: c.phone })
    .where(and(eq(appointments.id, z.uuid().parse(appointmentId)), eq(appointments.businessId, ctx.business.id)))
    .returning({ id: appointments.id });
  if (!updated.length) return { ok: false, error: "Rendez-vous introuvable." };
  await log(ctx, "appointment.reassign", `Rendez-vous rattaché à ${c.fullName}`);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Recherche de fiches (fusion, rattachement). */
export async function searchCustomers(query: string, excludeId?: string): Promise<{ id: string; name: string; email: string | null; phone: string | null }[]> {
  const ctx = await requireContext("customers.view", { app: "clients" });
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const like = `%${q.replace(/[%_\\]/g, (ch) => `\\${ch}`)}%`;
  const rows = await db
    .select({ id: customers.id, name: customers.fullName, email: customers.email, phone: customers.phone })
    .from(customers)
    .where(and(eq(customers.businessId, ctx.business.id), sql`(${customers.fullName} ilike ${like} or ${customers.email} ilike ${like} or ${customers.phone} ilike ${like})`))
    .limit(8);
  return rows.filter((r) => r.id !== excludeId);
}

/* ───────────────────────────── Dossier ───────────────────────────── */

const noteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  title: z.string().trim().max(120),
  note: z.string().trim().max(10000),
  todo: z.string().trim().max(2000),
});

/** Crée ou modifie une note du dossier, avec un PDF facultatif (chiffré sur le disque). */
export async function saveNote(customerId: string, noteId: string | null, fd: FormData): Promise<CustomerState> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  const c = await ownCustomer(ctx.business.id, customerId);
  if (!c) return { error: "Fiche introuvable." };
  const parsed = noteSchema.safeParse(Object.fromEntries(["date", "title", "note", "todo"].map((k) => [k, String(fd.get(k) ?? "")])));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const v = parsed.data;

  const file = fd.get("file");
  let upload: { path: string; name: string; size: number } | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PDF) return { error: "Le PDF dépasse 10 Mo." };
    const data = Buffer.from(await file.arrayBuffer());
    if (!isPdf(data)) return { error: "Seuls les fichiers PDF sont acceptés." };
    upload = { path: await savePrivateFile(data), name: (file.name || "document.pdf").slice(0, 200), size: file.size };
  }
  const remove = fd.get("removeFile") === "1";
  if (!v.title && !v.note && !v.todo && !upload) return { error: "La note est vide." };

  const values = { date: v.date, title: v.title || null, noteEnc: encrypt(v.note), todoEnc: encrypt(v.todo) };
  if (noteId) {
    const [existing] = await db.select().from(customerNotes).where(and(eq(customerNotes.id, z.uuid().parse(noteId)), eq(customerNotes.customerId, c.id)));
    if (!existing) return { error: "Note introuvable." };
    const fileValues = upload ? { attachmentPath: upload.path, attachmentName: upload.name, attachmentSize: upload.size } : remove ? { attachmentPath: null, attachmentName: null, attachmentSize: null } : {};
    await db.update(customerNotes).set({ ...values, ...fileValues }).where(eq(customerNotes.id, existing.id));
    if (upload || remove) await deletePrivateFile(existing.attachmentPath);
  } else {
    await db.insert(customerNotes).values({ ...values, customerId: c.id, authorMemberId: ctx.member.id, attachmentPath: upload?.path ?? null, attachmentName: upload?.name ?? null, attachmentSize: upload?.size ?? null });
  }
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true };
}

export async function deleteNote(customerId: string, noteId: string): Promise<{ ok: boolean }> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  const c = await ownCustomer(ctx.business.id, customerId);
  if (!c) return { ok: false };
  const [deleted] = await db.delete(customerNotes).where(and(eq(customerNotes.id, z.uuid().parse(noteId)), eq(customerNotes.customerId, c.id))).returning({ path: customerNotes.attachmentPath });
  await deletePrivateFile(deleted?.path);
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true };
}

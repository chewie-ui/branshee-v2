"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, customerNotes, customers } from "@/db/schema";
import { encrypt } from "@/lib/field-crypto";
import { requireContext } from "@/server/context";

export type CustomerState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;

async function ownCustomer(businessId: string, customerId: string) {
  const [c] = await db.select().from(customers).where(and(eq(customers.id, z.uuid().parse(customerId)), eq(customers.businessId, businessId)));
  return c ?? null;
}

const contactSchema = z.object({
  fullName: z.string().trim().min(1, "Indiquez un nom.").max(120),
  email: z.union([z.literal(""), z.email({ message: "Email invalide." })]),
  phone: z.string().trim().max(40),
  altName: z.string().trim().max(120),
  altPhone: z.string().trim().max(40),
  generalInfo: z.string().trim().max(5000),
});

export async function saveCustomer(customerId: string, _prev: CustomerState, fd: FormData): Promise<CustomerState> {
  const ctx = await requireContext("customers.manage");
  const c = await ownCustomer(ctx.business.id, customerId);
  if (!c) return { error: "Client introuvable." };
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const parsed = contactSchema.safeParse({ fullName: g("fullName"), email: g("email").toLowerCase(), phone: g("phone"), altName: g("altName"), altPhone: g("altPhone"), generalInfo: g("generalInfo") });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Vérifiez les champs indiqués.", fieldErrors };
  }
  const v = parsed.data;
  try {
    await db
      .update(customers)
      .set({ fullName: v.fullName, email: v.email || null, phone: v.phone || null, altName: v.altName || null, altPhone: v.altPhone || null, generalInfoEnc: encrypt(v.generalInfo) })
      .where(eq(customers.id, c.id));
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    if (err.code === "23505" || err.cause?.code === "23505") return { error: "Vérifiez les champs indiqués.", fieldErrors: { email: "Un autre client utilise déjà cet email." } };
    throw e;
  }
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "customer.update", description: `Fiche client modifiée : ${v.fullName}` });
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true };
}

export async function setCustomerBlocked(customerId: string, blocked: boolean, reason: string): Promise<{ ok: boolean }> {
  const ctx = await requireContext("customers.manage");
  const c = await ownCustomer(ctx.business.id, customerId);
  if (!c) return { ok: false };
  await db.update(customers).set({ blockedAt: blocked ? new Date() : null, blockedReason: blocked ? reason.slice(0, 200) || null : null }).where(eq(customers.id, c.id));
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: blocked ? "customer.block" : "customer.unblock", description: `${blocked ? "Client bloqué" : "Client débloqué"} : ${c.fullName}` });
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true };
}

const noteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  title: z.string().trim().max(120),
  note: z.string().trim().max(10000),
  todo: z.string().trim().max(2000),
});

export async function saveNote(customerId: string, noteId: string | null, input: Record<string, string>): Promise<CustomerState> {
  const ctx = await requireContext("customers.manage");
  const c = await ownCustomer(ctx.business.id, customerId);
  if (!c) return { error: "Client introuvable." };
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const v = parsed.data;
  if (!v.title && !v.note && !v.todo) return { error: "La note est vide." };
  const values = { date: v.date, title: v.title || null, noteEnc: encrypt(v.note), todoEnc: encrypt(v.todo) };
  if (noteId) {
    const updated = await db.update(customerNotes).set(values).where(and(eq(customerNotes.id, z.uuid().parse(noteId)), eq(customerNotes.customerId, c.id))).returning({ id: customerNotes.id });
    if (!updated.length) return { error: "Note introuvable." };
  } else {
    await db.insert(customerNotes).values({ ...values, customerId: c.id, authorMemberId: ctx.member.id });
  }
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true };
}

export async function deleteNote(customerId: string, noteId: string): Promise<{ ok: boolean }> {
  const ctx = await requireContext("customers.manage");
  const c = await ownCustomer(ctx.business.id, customerId);
  if (!c) return { ok: false };
  await db.delete(customerNotes).where(and(eq(customerNotes.id, z.uuid().parse(noteId)), eq(customerNotes.customerId, c.id)));
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true };
}

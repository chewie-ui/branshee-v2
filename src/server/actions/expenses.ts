"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, expenses } from "@/db/schema";
import { isExpenseCategory } from "@/lib/expenses";
import { isDay } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { deletePrivateFile, isPdf, savePrivateFile, sniffImage } from "@/server/storage";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const euros = z.coerce.number().min(0).max(1_000_000).transform((n) => Math.round(n * 100));
const schema = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  date: z.string().refine(isDay, "Date invalide."),
  amount: euros.refine((n) => n > 0, "Indiquez un montant supérieur à 0."),
  vat: euros,
  supplier: z.string().trim().max(120),
  category: z.string().refine(isExpenseCategory, "Catégorie invalide."),
  description: z.string().trim().max(300),
  removeProof: z.literal("1").optional(),
});
const MAX = 10 * 1024 * 1024;

/** Ajouter ou modifier une dépense, avec son justificatif (photo ou PDF, 10 Mo max, chiffré sur le serveur). */
export async function saveExpense(fd: FormData): Promise<Result> {
  const ctx = await requireContext("invoices.manage");
  if (ctx.impersonating) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const v = schema.safeParse(Object.fromEntries([...fd.entries()].filter(([, val]) => typeof val === "string")));
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  if (d.vat > d.amount) return { ok: false, error: "La TVA ne peut pas dépasser le montant payé." };

  let proof: { proofRef: string; proofName: string; proofType: string } | null = null;
  const file = fd.get("proof");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX) return { ok: false, error: "Justificatif trop lourd (10 Mo maximum)." };
    const data = Buffer.from(await file.arrayBuffer());
    const type = isPdf(data) ? "application/pdf" : sniffImage(data);
    if (!type) return { ok: false, error: "Justificatif : une photo (JPG, PNG, WebP) ou un PDF." };
    proof = { proofRef: await savePrivateFile(data), proofName: (file.name || "justificatif").slice(0, 200), proofType: type };
  }

  const values = { date: d.date, amountCents: d.amount, vatCents: d.vat, supplier: d.supplier || null, category: d.category, description: d.description || null, updatedAt: new Date() };
  if (d.id) {
    const [old] = await db.select({ ref: expenses.proofRef }).from(expenses).where(and(eq(expenses.id, d.id), eq(expenses.businessId, ctx.business.id)));
    if (!old) return { ok: false, error: "Dépense introuvable." };
    const clear = !proof && d.removeProof ? { proofRef: null, proofName: null, proofType: null } : {};
    await db.update(expenses).set({ ...values, ...(proof ?? {}), ...clear }).where(and(eq(expenses.id, d.id), eq(expenses.businessId, ctx.business.id)));
    if ((proof || d.removeProof) && old.ref) await deletePrivateFile(old.ref);
  } else {
    await db.insert(expenses).values({ ...values, ...(proof ?? {}), businessId: ctx.business.id, createdById: ctx.user.id });
    await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "expense.add", description: `Dépense ajoutée : ${d.supplier || d.category}` });
  }
  revalidatePath("/app/depenses");
  return { ok: true, message: d.id ? "Dépense mise à jour." : "Dépense ajoutée." };
}

export async function deleteExpense(id: string): Promise<Result> {
  const ctx = await requireContext("invoices.manage");
  if (ctx.impersonating) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Dépense introuvable." };
  const [gone] = await db.delete(expenses).where(and(eq(expenses.id, parsed.data), eq(expenses.businessId, ctx.business.id))).returning({ ref: expenses.proofRef });
  if (!gone) return { ok: false, error: "Dépense introuvable." };
  await deletePrivateFile(gone.ref);
  revalidatePath("/app/depenses");
  return { ok: true, message: "Dépense supprimée." };
}

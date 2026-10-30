"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { members, payrollClosures, payrollEntries, payrollProfiles } from "@/db/schema";
import { isMonth } from "@/lib/payroll";
import { requireContext } from "@/server/context";
import { payrollMonth, payrollRights } from "@/server/payroll";

type Result = { ok: true; message?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const refresh = () => revalidatePath("/app/paie", "layout");

async function manager() {
  const ctx = await requireContext(undefined, { app: "paie" });
  if (ctx.impersonating) return { ctx, error: SUPERVISION };
  if (!payrollRights(ctx).manage) return { ctx, error: { ok: false as const, error: "Réservé au responsable." } };
  return { ctx, error: null };
}
async function ownMember(businessId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return false;
  const [m] = await db.select({ id: members.id }).from(members).where(and(eq(members.id, id), eq(members.businessId, businessId)));
  return !!m;
}

const profileSchema = z.object({
  memberId: z.uuid(),
  weeklyHours: z.number().min(1).max(60),
  payType: z.enum(["hourly", "monthly"]),
  rate: z.number().min(0).max(100000),
  mealVouchers: z.boolean(),
  externalId: z.string().trim().max(40),
});

export async function savePayrollProfile(input: z.input<typeof profileSchema>): Promise<Result> {
  const { ctx, error } = await manager();
  if (error) return error;
  const v = profileSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Vérifiez le contrat (heures entre 1 et 60)." };
  if (!(await ownMember(ctx.business.id, v.data.memberId))) return { ok: false, error: "Membre introuvable." };
  const values = { weeklyMinutes: Math.round(v.data.weeklyHours * 60), payType: v.data.payType, rateCents: Math.round(v.data.rate * 100), mealVouchers: v.data.mealVouchers, externalId: v.data.externalId || null, updatedAt: new Date() };
  await db.insert(payrollProfiles).values({ memberId: v.data.memberId, businessId: ctx.business.id, ...values }).onConflictDoUpdate({ target: payrollProfiles.memberId, set: values });
  refresh();
  return { ok: true, message: "Contrat enregistré." };
}

const entrySchema = z.object({ memberId: z.uuid(), month: z.string().refine(isMonth), adjustMinutes: z.number().int().min(-10000).max(10000), bonus: z.number().min(0).max(100000), km: z.number().int().min(0).max(100000), note: z.string().trim().max(300) });

export async function savePayrollEntry(input: z.input<typeof entrySchema>): Promise<Result> {
  const { ctx, error } = await manager();
  if (error) return error;
  const v = entrySchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Valeurs invalides." };
  if (!(await ownMember(ctx.business.id, v.data.memberId))) return { ok: false, error: "Membre introuvable." };
  const [closed] = await db.select({ m: payrollClosures.month }).from(payrollClosures).where(and(eq(payrollClosures.businessId, ctx.business.id), eq(payrollClosures.month, v.data.month)));
  if (closed) return { ok: false, error: "Ce mois est validé : rouvrez-le pour le modifier." };
  const values = { adjustMinutes: v.data.adjustMinutes, bonusCents: Math.round(v.data.bonus * 100), km: v.data.km, note: v.data.note || null, updatedAt: new Date() };
  await db.insert(payrollEntries).values({ businessId: ctx.business.id, memberId: v.data.memberId, month: v.data.month, ...values }).onConflictDoUpdate({ target: [payrollEntries.businessId, payrollEntries.memberId, payrollEntries.month], set: values });
  refresh();
  return { ok: true, message: "Enregistré." };
}

export async function setPayrollClosed(month: string, closed: boolean): Promise<Result> {
  const { ctx, error } = await manager();
  if (error) return error;
  if (!isMonth(month)) return { ok: false, error: "Mois invalide." };
  if (closed) {
    const { rows } = await payrollMonth(ctx.business.id, month);
    await db.insert(payrollClosures).values({ businessId: ctx.business.id, month, closedById: ctx.user.id, snapshot: rows }).onConflictDoNothing();
  }
  else await db.delete(payrollClosures).where(and(eq(payrollClosures.businessId, ctx.business.id), eq(payrollClosures.month, month)));
  refresh();
  return { ok: true, message: closed ? "Mois validé : téléchargez l'export pour votre secrétariat social." : "Mois rouvert." };
}

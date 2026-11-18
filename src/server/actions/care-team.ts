"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { careTeamMembers, customers } from "@/db/schema";
import { requireContext } from "@/server/context";
import { CARE_TEAM_ROLES } from "@/lib/care-team";
import { logRecordAccess } from "@/server/physio";

type Result = { ok: true; message: string } | { ok: false; error: string };
const RO = { ok: false as const, error: "Mode supervision : lecture seule." };
const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

const memberSchema = z.object({
  role: z.enum(CARE_TEAM_ROLES.map((r) => r.key) as [string, ...string[]]),
  name: z.string().trim().min(2, "Indiquez le nom.").max(120),
  profession: opt(80),
  inami: opt(20),
  enterpriseNumber: opt(20),
  address: opt(200),
  phone: opt(40),
  email: z.string().trim().max(160).optional().transform((v) => (v ? v : null)).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email invalide."),
  iban: opt(40),
});

/** Ajoute ou modifie un membre de l'équipe de soins du patient (médecin, infirmier, aide familiale…). */
export async function saveCareTeamMember(customerId: string, memberId: string | null, input: unknown): Promise<Result> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  if (!z.uuid().safeParse(customerId).success) return { ok: false, error: "Fiche introuvable." };
  const [c] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, customerId), eq(customers.businessId, ctx.business.id)));
  if (!c) return { ok: false, error: "Fiche introuvable." };
  const v = memberSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  if (memberId) {
    if (!z.uuid().safeParse(memberId).success) return { ok: false, error: "Introuvable." };
    const r = await db.update(careTeamMembers).set({ ...v.data, updatedAt: new Date() }).where(and(eq(careTeamMembers.id, memberId), eq(careTeamMembers.customerId, c.id), eq(careTeamMembers.businessId, ctx.business.id))).returning({ id: careTeamMembers.id });
    if (!r.length) return { ok: false, error: "Introuvable." };
  } else {
    await db.insert(careTeamMembers).values({ businessId: ctx.business.id, customerId: c.id, ...v.data });
  }
  await logRecordAccess(ctx, c.id, "edit", `Équipe de soins : ${v.data.name}`);
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true, message: memberId ? "Membre mis à jour." : "Ajouté à l'équipe de soins." };
}

export async function removeCareTeamMember(customerId: string, memberId: string): Promise<Result> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  if (!z.uuid().safeParse(customerId).success || !z.uuid().safeParse(memberId).success) return { ok: false, error: "Introuvable." };
  const r = await db.delete(careTeamMembers).where(and(eq(careTeamMembers.id, memberId), eq(careTeamMembers.customerId, customerId), eq(careTeamMembers.businessId, ctx.business.id))).returning({ name: careTeamMembers.name });
  if (!r.length) return { ok: false, error: "Introuvable." };
  await logRecordAccess(ctx, customerId, "edit", `Équipe de soins : retrait de ${r[0]!.name}`);
  revalidatePath(`/app/clients/${customerId}`);
  return { ok: true, message: "Retiré de l'équipe de soins." };
}

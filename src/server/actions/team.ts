"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, grades, members, users } from "@/db/schema";
import { NO_PERMISSIONS, PERMISSIONS, type Permissions } from "@/lib/permissions";
import { requireContext, type AppContext } from "@/server/context";

export type TeamState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const log = (ctx: AppContext, action: string, description: string) =>
  db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action, description });

async function ownGrade(ctx: AppContext, gradeId: string) {
  if (!gradeId) return null;
  const [g] = await db.select({ id: grades.id }).from(grades).where(and(eq(grades.id, gradeId), eq(grades.businessId, ctx.business.id)));
  return g?.id ?? null;
}

const addSchema = z.object({
  displayName: z.string().min(2, "Indiquez un nom.").max(80),
  email: z.union([z.literal(""), z.email({ message: "Email invalide." })]),
  roleLabel: z.string().max(60),
  gradeId: z.string(),
  isBookable: z.boolean(),
});

/** Ajoute un membre. Avec un email, il est relié à son compte (existant ou créé plus tard). */
export async function addMember(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const ctx = await requireContext("team.manage");
  const parsed = addSchema.safeParse({ displayName: str(fd, "displayName"), email: str(fd, "email").toLowerCase(), roleLabel: str(fd, "roleLabel"), gradeId: str(fd, "gradeId"), isBookable: fd.get("isBookable") === "on" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Vérifiez les champs indiqués.", fieldErrors };
  }
  const v = parsed.data;

  let userId: string | null = null;
  if (v.email) {
    const [u] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${v.email}`);
    userId = u?.id ?? null;
    const [dup] = await db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.businessId, ctx.business.id), userId ? eq(members.userId, userId) : sql`lower(${members.inviteEmail}) = ${v.email}`));
    if (dup) return { error: "Vérifiez les champs indiqués.", fieldErrors: { email: "Cette personne fait déjà partie de l'équipe." } };
  }

  await db.insert(members).values({
    businessId: ctx.business.id,
    userId,
    inviteEmail: v.email || null,
    status: userId || !v.email ? "active" : "invited",
    gradeId: await ownGrade(ctx, v.gradeId),
    displayName: v.displayName,
    roleLabel: v.roleLabel || null,
    showRole: !!v.roleLabel,
    isBookable: v.isBookable,
    joinedAt: userId ? new Date() : null,
  });
  await log(ctx, "team.add", `Membre ajouté : ${v.displayName}`);
  revalidatePath("/app/equipe");
  redirect("/app/equipe");
}

const updateSchema = z.object({
  displayName: z.string().min(2, "Indiquez un nom.").max(80),
  roleLabel: z.string().max(60),
  bio: z.string().max(500),
  showRole: z.boolean(),
  gradeId: z.string(),
  isBookable: z.boolean(),
  isActive: z.boolean(),
  timeOff: z.enum(["inherit", "yes", "no"]),
});

export async function updateMember(memberId: string, _prev: TeamState, fd: FormData): Promise<TeamState> {
  const ctx = await requireContext("team.manage");
  const [m] = await db.select().from(members).where(and(eq(members.id, z.uuid().parse(memberId)), eq(members.businessId, ctx.business.id)));
  if (!m) return { error: "Membre introuvable." };
  const parsed = updateSchema.safeParse({
    displayName: str(fd, "displayName"),
    roleLabel: str(fd, "roleLabel"),
    bio: str(fd, "bio"),
    showRole: fd.get("showRole") === "on",
    gradeId: str(fd, "gradeId"),
    isBookable: fd.get("isBookable") === "on",
    isActive: m.isOwner ? true : fd.get("isActive") === "on",
    timeOff: str(fd, "timeOff") || "inherit",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Vérifiez les champs indiqués.", fieldErrors };
  }
  const v = parsed.data;
  // On ne peut pas retirer ses propres droits d'administration par erreur.
  if (m.id === ctx.member.id && !m.isOwner && v.gradeId !== (m.gradeId ?? "")) return { error: "Vous ne pouvez pas changer votre propre grade." };

  await db
    .update(members)
    .set({
      displayName: v.displayName,
      roleLabel: v.roleLabel || null,
      bio: v.bio || null,
      showRole: v.showRole,
      gradeId: m.isOwner ? m.gradeId : await ownGrade(ctx, v.gradeId),
      isBookable: v.isBookable,
      isActive: v.isActive,
      canManageOwnTimeOff: v.timeOff === "inherit" ? null : v.timeOff === "yes",
    })
    .where(eq(members.id, m.id));
  await log(ctx, "team.update", `Membre modifié : ${v.displayName}`);
  revalidatePath("/app/equipe");
  return { ok: true };
}

export async function removeMember(memberId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("team.manage");
  const [m] = await db.select().from(members).where(and(eq(members.id, z.uuid().parse(memberId)), eq(members.businessId, ctx.business.id)));
  if (!m) return { ok: false, error: "Membre introuvable." };
  if (m.isOwner) return { ok: false, error: "Le propriétaire ne peut pas être retiré." };
  if (m.id === ctx.member.id) return { ok: false, error: "Vous ne pouvez pas vous retirer vous-même." };
  // Ses RDV restent dans l'historique (le praticien y apparaît alors comme non renseigné).
  await db.delete(members).where(eq(members.id, m.id));
  await log(ctx, "team.remove", `Membre retiré : ${m.displayName}`);
  revalidatePath("/app/equipe");
  redirect("/app/equipe");
}

export async function saveGrade(gradeId: string | null, _prev: TeamState, fd: FormData): Promise<TeamState> {
  const ctx = await requireContext("grades.manage");
  const name = str(fd, "name");
  if (name.length < 2 || name.length > 40) return { error: "Vérifiez les champs indiqués.", fieldErrors: { name: "Entre 2 et 40 caractères." } };

  const permissions = structuredClone(NO_PERMISSIONS) as Record<string, Record<string, boolean>>;
  for (const [domain, def] of Object.entries(PERMISSIONS)) {
    for (const action of Object.keys(def.actions)) permissions[domain]![action] = fd.get(`${domain}.${action}`) === "on";
  }

  try {
    if (gradeId) {
      const updated = await db
        .update(grades)
        .set({ name, permissions: permissions as Permissions })
        .where(and(eq(grades.id, z.uuid().parse(gradeId)), eq(grades.businessId, ctx.business.id)))
        .returning({ id: grades.id });
      if (!updated.length) return { error: "Grade introuvable." };
    } else {
      await db.insert(grades).values({ businessId: ctx.business.id, name, permissions: permissions as Permissions });
    }
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    if (err.code === "23505" || err.cause?.code === "23505") return { error: "Vérifiez les champs indiqués.", fieldErrors: { name: "Un grade porte déjà ce nom." } };
    throw e;
  }
  await log(ctx, gradeId ? "grade.update" : "grade.create", `Grade ${gradeId ? "modifié" : "créé"} : ${name}`);
  revalidatePath("/app/equipe/grades");
  redirect("/app/equipe/grades");
}

export async function deleteGrade(gradeId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("grades.manage");
  const id = z.uuid().parse(gradeId);
  const [g] = await db.select().from(grades).where(and(eq(grades.id, id), eq(grades.businessId, ctx.business.id)));
  if (!g) return { ok: false, error: "Grade introuvable." };
  if (g.isBuiltIn) return { ok: false, error: "Les grades intégrés ne peuvent pas être supprimés." };
  const [{ n }] = await db.select({ n: count() }).from(members).where(eq(members.gradeId, id));
  if (n > 0) return { ok: false, error: `Ce grade est attribué à ${n} membre${n > 1 ? "s" : ""}. Changez-leur de grade d'abord.` };
  await db.delete(grades).where(eq(grades.id, id));
  await log(ctx, "grade.delete", `Grade supprimé : ${g.name}`);
  revalidatePath("/app/equipe/grades");
  redirect("/app/equipe/grades");
}

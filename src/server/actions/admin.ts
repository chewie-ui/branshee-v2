"use server";

import { TZDate } from "@date-fns/tz";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, businessPlans, businesses, notificationSettings, sessions, users } from "@/db/schema";
import { requireSuperadmin } from "@/server/admin";

type Result = { ok: boolean; error?: string; message?: string };

/** Met en pause (ou réactive) la réservation en ligne d'un établissement. */
export async function setBusinessPaused(businessId: string, paused: boolean): Promise<Result> {
  const admin = await requireSuperadmin();
  const id = z.uuid().parse(businessId);
  const [b] = await db.update(businesses).set({ pausedAt: paused ? new Date() : null }).where(eq(businesses.id, id)).returning({ id: businesses.id });
  if (!b) return { ok: false, error: "Établissement introuvable." };
  await db.insert(activityLogs).values({ businessId: id, userId: admin.id, actorName: "Équipe Branshee", action: paused ? "admin.pause" : "admin.resume", description: paused ? "Réservation en ligne mise en pause par Branshee" : "Réservation en ligne réactivée par Branshee" });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

const grantSchema = z.object({
  plan: z.enum(["free", "pro", "pro_plus"]),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
});

/** Forfait offert à un établissement jusqu'à une date (vide = retirer l'accès offert). */
export async function grantPlan(businessId: string, input: { plan: string; until: string }): Promise<Result> {
  await requireSuperadmin();
  const id = z.uuid().parse(businessId);
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forfait ou date invalide." };
  const { plan, until } = parsed.data;
  // Fin de journée à Bruxelles (sinon la date affichée glisse au lendemain).
  const [y, m, d] = until.split("-").map(Number) as [number, number, number];
  const grantedUntil = until ? new Date(new TZDate(y, m - 1, d, 23, 59, 59, "Europe/Brussels").getTime()) : null;
  if (grantedUntil && grantedUntil < new Date()) return { ok: false, error: "Choisissez une date dans le futur." };
  const [b] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, id));
  if (!b) return { ok: false, error: "Établissement introuvable." };
  const [cur] = await db.select().from(businessPlans).where(eq(businessPlans.businessId, id));
  if (cur?.stripeSubscriptionId && ["active", "trialing", "past_due"].includes(cur.status)) return { ok: false, error: "Cet établissement a un abonnement Stripe actif : gérez-le depuis Stripe." };
  const values = grantedUntil ? { plan, grantedUntil, status: "active" as const, stripeSubscriptionId: null } : { plan: "free" as const, grantedUntil: null };
  await db.insert(businessPlans).values({ businessId: id, ...values }).onConflictDoUpdate({ target: businessPlans.businessId, set: values });
  // Forfait payant offert à un établissement gratuit : rappels SMS allumés, comme après un paiement.
  if (grantedUntil && (!cur || cur.plan === "free")) {
    await db.insert(notificationSettings).values({ businessId: id, smsReminders: true }).onConflictDoUpdate({ target: notificationSettings.businessId, set: { smsReminders: true } });
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: grantedUntil ? "Forfait offert enregistré." : "Accès offert retiré." };
}

/** Désactive un compte (connexion impossible, sessions fermées) ou le réactive. */
export async function setUserDisabled(userId: string, disabled: boolean): Promise<Result> {
  const admin = await requireSuperadmin();
  const id = z.uuid().parse(userId);
  if (id === admin.id) return { ok: false, error: "Vous ne pouvez pas désactiver votre propre compte." };
  const [u] = await db.update(users).set({ disabledAt: disabled ? new Date() : null }).where(eq(users.id, id)).returning({ id: users.id });
  if (!u) return { ok: false, error: "Utilisateur introuvable." };
  if (disabled) await db.delete(sessions).where(eq(sessions.userId, id));
  revalidatePath("/admin", "layout");
  return { ok: true };
}

"use server";

import { TZDate } from "@date-fns/tz";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, businessPlans, businesses, notificationSettings, sessions, users } from "@/db/schema";
import { requireSuperadmin } from "@/server/admin";
import { lockedProPrice, planFromStripePrice, syncSubscription } from "@/server/billing";
import { stripe } from "@/server/payments";

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
  const values = grantedUntil ? { plan, grantedUntil, status: "active" as const, stripeSubscriptionId: null, isTrial: false } : { plan: "free" as const, grantedUntil: null, isTrial: false };
  await db.insert(businessPlans).values({ businessId: id, ...values }).onConflictDoUpdate({ target: businessPlans.businessId, set: values });
  // Forfait payant offert à un établissement gratuit : rappels SMS allumés, comme après un paiement.
  if (grantedUntil && (!cur || cur.plan === "free")) {
    await db.insert(notificationSettings).values({ businessId: id, smsReminders: true }).onConflictDoUpdate({ target: notificationSettings.businessId, set: { smsReminders: true } });
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: grantedUntil ? "Forfait offert enregistré." : "Accès offert retiré." };
}

/**
 * Tarif garanti à vie du forfait Pro mensuel (ex. 19 € promis aux premières clientes).
 * Appliqué à leur prochain paiement ; si elles sont déjà abonnées en Pro, leur abonnement passe tout de suite à ce prix.
 */
export async function setLockedPrice(businessId: string, euros: number | null): Promise<Result> {
  const admin = await requireSuperadmin();
  const id = z.uuid().parse(businessId);
  const cents = euros == null ? null : Math.round(Number(euros) * 100);
  if (cents != null && (!Number.isFinite(cents) || cents < 100 || cents > 100000)) return { ok: false, error: "Indiquez un prix entre 1 € et 1 000 €." };
  const [b] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, id));
  if (!b) return { ok: false, error: "Établissement introuvable." };
  await db.insert(businessPlans).values({ businessId: id, lockedPriceCents: cents }).onConflictDoUpdate({ target: businessPlans.businessId, set: { lockedPriceCents: cents } });
  let applied = "";
  const [cur] = await db.select().from(businessPlans).where(eq(businessPlans.businessId, id));
  const s = stripe();
  if (cents && s && cur?.stripeSubscriptionId && ["active", "trialing", "past_due"].includes(cur.status) && cur.plan === "pro") {
    const sub = await s.subscriptions.retrieve(cur.stripeSubscriptionId).catch(() => null);
    const item = sub?.items.data.find((i) => planFromStripePrice(i.price)?.plan === "pro");
    const price = await lockedProPrice(cents);
    if (sub && item && price && item.price.id !== price) {
      const updated = await s.subscriptions.update(sub.id, { items: [{ id: item.id, price }], proration_behavior: "none" });
      await syncSubscription(updated);
      applied = " L'abonnement en cours est passé à ce prix dès la prochaine facture.";
    }
  }
  const label = cents ? `${(cents / 100).toFixed(2).replace(".", ",")} €` : "";
  await db.insert(activityLogs).values({ businessId: id, userId: admin.id, actorName: "Équipe Branshee", action: "admin.locked-price", description: cents ? `Tarif Pro garanti à vie : ${label}/mois TVAC` : "Tarif garanti à vie retiré" });
  revalidatePath("/admin", "layout");
  return { ok: true, message: cents ? `Tarif garanti enregistré : ${label}/mois TVAC, à vie.${applied}` : "Tarif garanti retiré : le prix normal s'appliquera aux prochains abonnements (un abonnement en cours garde son prix)." };
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

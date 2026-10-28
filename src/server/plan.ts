import "server-only";
import { cache } from "react";
import { and, count, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, businessPlans, businesses, members, subscriptions } from "@/db/schema";
import { MAX_USERS } from "@/lib/skydev-plans";
import { canCreateBusiness, collaboratorLimit, hasFeature, limitOf, planLabel, type Feature, type Plan, LIMITS } from "@/lib/plans";

export type EffectivePlan = {
  plan: Plan;
  /** D'où vient le forfait : abonnement Stripe de l'établissement, accès offert, ancien abonnement du compte, ou gratuit. */
  source: "stripe" | "granted" | "account" | "free";
  status: string;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  grantedUntil: Date | null;
  /** Accès en cours = essai gratuit de 30 jours. */
  isTrial: boolean;
  extraSeats: number;
  customUrlAddon: boolean;
  stripeSubscriptionId: string | null;
  /** Abonnement Skydev par utilisateur : nombre d'utilisateurs facturés (null = forfait classique). */
  billedUsers: number | null;
};

const FREE: EffectivePlan = { plan: "free", source: "free", status: "active", periodEnd: null, cancelAtPeriodEnd: false, grantedUntil: null, isTrial: false, extraSeats: 0, customUrlAddon: false, stripeSubscriptionId: null, billedUsers: null };

/**
 * Forfait effectif d'un établissement. Un accès offert expiré ne débloque jamais rien ;
 * un abonnement Stripe en retard de paiement garde l'accès (le temps que Stripe relance).
 */
export const effectivePlan = cache(async (businessId: string): Promise<EffectivePlan> => {
  const now = new Date();
  const [row] = await db.select().from(businessPlans).where(eq(businessPlans.businessId, businessId));
  if (row && row.plan !== "free") {
    const base = { periodEnd: row.periodEnd, cancelAtPeriodEnd: row.cancelAtPeriodEnd, grantedUntil: row.grantedUntil, isTrial: row.isTrial, extraSeats: row.extraSeats, customUrlAddon: row.customUrlAddon, stripeSubscriptionId: row.stripeSubscriptionId, status: row.status, billedUsers: row.billedUsers };
    if (row.stripeSubscriptionId && ["active", "trialing", "past_due"].includes(row.status)) return { ...base, plan: row.plan, source: "stripe" };
    if (!row.stripeSubscriptionId && (!row.grantedUntil || row.grantedUntil > now) && row.status === "active") return { ...base, plan: row.plan, source: "granted" };
  }
  // Ancien système : forfait porté par le compte du propriétaire.
  const [owner] = await db.select({ sub: subscriptions }).from(businesses).innerJoin(subscriptions, eq(subscriptions.userId, businesses.ownerId)).where(eq(businesses.id, businessId));
  const sub = owner?.sub;
  if (sub && sub.plan !== "free" && ["active", "trialing", "past_due"].includes(sub.status)) {
    const grantExpired = sub.grantedUntil && sub.grantedUntil <= now;
    if (!grantExpired || sub.stripeSubscriptionId) {
      return { plan: sub.plan, source: "account", status: sub.status, periodEnd: sub.currentPeriodEnd, cancelAtPeriodEnd: sub.cancelAtPeriodEnd, grantedUntil: sub.grantedUntil, isTrial: false, extraSeats: sub.extraSeats, customUrlAddon: row?.customUrlAddon ?? false, stripeSubscriptionId: sub.stripeSubscriptionId, billedUsers: null };
    }
  }
  return { ...FREE, extraSeats: row?.extraSeats ?? 0, customUrlAddon: row?.customUrlAddon ?? false };
});

/**
 * Skydev : essai terminé sans abonnement → l'espace passe en lecture seule (tout reste consultable et exportable,
 * plus rien ne se crée ni ne se modifie, les pages publiques de vente sont fermées). Branshee garde son fonctionnement.
 */
export const isLocked = cache(async (businessId: string, brand?: string | null): Promise<boolean> => {
  let b = brand;
  if (b === undefined) [{ b = null } = {}] = await db.select({ b: businesses.brand }).from(businesses).where(eq(businesses.id, businessId));
  // Marque vide = celle du serveur (FORCE_BRAND), comme pour les prix.
  const brandOf = b === "skydev" || b === "branshee" ? b : process.env.FORCE_BRAND === "skydev" ? "skydev" : "branshee";
  if (brandOf !== "skydev") return false;
  return (await effectivePlan(businessId)).source === "free";
});

export async function businessHas(businessId: string, feature: Feature) {
  const p = await effectivePlan(businessId);
  return hasFeature(p.plan, feature, { customUrl: p.customUrlAddon });
}

/** Message d'invitation à passer au forfait supérieur. */
export function upgradeMessage(feature: Feature | string, required: Plan) {
  return `Disponible avec le forfait ${planLabel(required)}. Changez de forfait dans Réglages › Abonnement.`;
}

export async function serviceLimitReached(businessId: string, activeCount: number) {
  const p = await effectivePlan(businessId);
  const max = limitOf(p.plan, "services");
  return activeCount >= max ? { reached: true as const, max, plan: p.plan } : { reached: false as const, max };
}

/** Places de collaborateurs : membres non-propriétaires actifs ou invités. */
export async function collaboratorUsage(businessId: string) {
  const p = await effectivePlan(businessId);
  const [{ n }] = await db
    .select({ n: count() })
    .from(members)
    .where(and(eq(members.businessId, businessId), eq(members.isOwner, false), inArray(members.status, ["active", "invited"]), eq(members.isActive, true)));
  // Abonnement Skydev par utilisateur : pas de limite, chaque personne ajoutée est facturée (prix dégressif).
  const max = p.source === "stripe" && p.billedUsers != null ? MAX_USERS - 1 : collaboratorLimit(p.plan, p.extraSeats);
  return { used: n, max, plan: p.plan, perUser: p.source === "stripe" && p.billedUsers != null };
}

/** RDV en ligne reçus ce mois-ci (pour la confirmation automatique du forfait gratuit). */
export async function onlineBookingsThisMonth(businessId: string, timezone: string) {
  const now = new Date();
  const start = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" }).format(now) + "-01T00:00:00Z");
  const [{ n }] = await db
    .select({ n: count() })
    .from(appointments)
    .where(and(eq(appointments.businessId, businessId), eq(appointments.kind, "appointment"), gte(appointments.createdAt, start), ne(appointments.status, "cancelled"), isNull(appointments.groupSessionId)));
  return n;
}

export async function autoConfirmAllowed(businessId: string, timezone: string) {
  const p = await effectivePlan(businessId);
  const max = LIMITS.autoConfirmUpTo[p.plan];
  if (max === Number.POSITIVE_INFINITY) return true;
  return (await onlineBookingsThisMonth(businessId, timezone)) < max;
}

export async function canUserCreateBusiness(userId: string) {
  const owned = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.ownerId, userId), isNull(businesses.deletedAt)));
  const plans = await Promise.all(owned.map((b) => effectivePlan(b.id).then((p) => p.plan)));
  return canCreateBusiness(plans);
}



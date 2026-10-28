import "server-only";
import { like } from "drizzle-orm";
import { db } from "@/db";
import { bookingPageSettings, bookingSettings, businessPlans, businesses, grades, members, notificationSettings, paymentSettings, weeklyHours } from "@/db/schema";
import { TRIAL_DAYS } from "@/lib/plans";
import { BUILT_IN_GRADES } from "@/lib/permissions";
import { slugify } from "@/lib/slug";

/** Slugs qui entreraient en conflit avec des pages du site. */
export const RESERVED_SLUGS = new Set(["app", "admin", "api", "connexion", "inscription", "bienvenue", "mot-de-passe-oublie", "tarifs", "contact", "blog", "aide", "pro", "s", "r", "js", "media", "uploads", "client", "espace-client", "sitemap.xml", "robots.txt", "auth", "ical", "acces", "verifier-email", "manifest.webmanifest", "icon.svg", "annuaire", "logiciel-rendez-vous", "confidentialite", "conditions-utilisation", "search", "register", "login", "subscription", "panel", "appointment", "demarrer", "manage-business", "s-inscrire", "site", "sites", "track", "apercu-site", "domaine", "settings", "history", "appointement", "clients-hub", "employees", "availability", "demandes", "etablissement", "customize-calendar", "forms", "group-sessions", "dashboard", "cancel-booking", "welcome", "superadmin", "support", "parrainage", "conditions", "cgu", "privacy", "forgot-password", "client-login", "client-register", "g", "account", "t", "avis", "imprimer", "signer", "partage", "documents", "desabonnement", "fidelite", "boutique", "commande", "facture"]);

async function freeSlug(name: string) {
  const base = slugify(name) || "etablissement";
  const taken = new Set((await db.select({ slug: businesses.slug }).from(businesses).where(like(businesses.slug, `${base}%`))).map((r) => r.slug));
  if (!taken.has(base) && !RESERVED_SLUGS.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}

/**
 * Crée un établissement complet et prêt à l'emploi : réglages par défaut, grades intégrés,
 * le propriétaire comme membre réservable, et des horaires du lundi au vendredi 9h–18h.
 * Avec `trial`, l'établissement démarre avec 30 jours du forfait Pro (rappels SMS compris).
 */
export async function createBusiness(owner: { id: string; fullName: string }, input: { name: string; businessType: string | null; city: string | null }, opts: { trial?: boolean; trialPlan?: "pro" | "pro_plus"; brand?: "skydev" | "branshee" } = {}) {
  const slug = await freeSlug(input.name);
  return db.transaction(async (tx) => {
    const [biz] = await tx.insert(businesses).values({ ownerId: owner.id, name: input.name, slug, businessType: input.businessType, city: input.city, brand: opts.brand ?? null }).returning();
    const bid = biz!.id;
    await tx.insert(bookingSettings).values({ businessId: bid });
    await tx.insert(paymentSettings).values({ businessId: bid });
    await tx.insert(notificationSettings).values({ businessId: bid, smsReminders: !!opts.trial });
    if (opts.trial) await tx.insert(businessPlans).values({ businessId: bid, ...trialValues(new Date(), opts.trialPlan) });
    await tx.insert(bookingPageSettings).values({ businessId: bid });
    await tx.insert(grades).values(BUILT_IN_GRADES.map((g) => ({ businessId: bid, name: g.name, isBuiltIn: true, permissions: g.permissions })));
    const [member] = await tx
      .insert(members)
      .values({ businessId: bid, userId: owner.id, isOwner: true, status: "active", displayName: owner.fullName, joinedAt: new Date() })
      .returning();
    await tx.insert(weeklyHours).values([1, 2, 3, 4, 5].map((weekday) => ({ businessId: bid, memberId: null, weekday, startTime: "09:00", endTime: "18:00" })));
    return { business: biz!, member: member! };
  });
}

/** Valeurs d'un essai Pro qui démarre maintenant. */
export function trialValues(now = new Date(), plan: "pro" | "pro_plus" = "pro") {
  return { plan, status: "active" as const, isTrial: true, grantedUntil: new Date(now.getTime() + TRIAL_DAYS * 86400_000), stripeSubscriptionId: null, grantReminder: {} };
}

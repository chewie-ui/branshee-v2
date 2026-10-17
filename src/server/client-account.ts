import "server-only";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, businesses, customers, members, reviews } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";

/**
 * Espace client : un compte voit les RDV de ses fiches clients (tous établissements confondus).
 * Les fiches ne sont rattachées qu'à une adresse VÉRIFIÉE — sinon n'importe qui pourrait créer
 * un compte avec l'email d'un autre et lire ses rendez-vous (données de santé chez un kiné).
 */
export async function linkCustomerRecords(userId: string, email: string) {
  await db
    .update(customers)
    .set({ userId })
    .where(and(isNull(customers.userId), sql`lower(${customers.email}) = ${email.toLowerCase()}`));
}

/** Utilisateur connecté de l'espace client ; adresse non vérifiée → page de vérification. */
export async function requireClient(next = "/espace-client") {
  const s = await getSessionUser();
  if (!s) redirect(`/connexion?suite=${encodeURIComponent(next)}`);
  if (!s.user.emailVerifiedAt) redirect(`/verifier-email?suite=${encodeURIComponent(next)}`);
  return s.user;
}

/** Le compte est-il membre d'au moins un établissement ? (choix de la page d'arrivée après connexion) */
export async function isPro(userId: string) {
  const [m] = await db
    .select({ id: members.id })
    .from(members)
    .innerJoin(businesses, eq(businesses.id, members.businessId))
    .where(and(eq(members.userId, userId), eq(members.status, "active"), isNull(businesses.deletedAt)))
    .limit(1);
  return !!m;
}

export async function listClientAppointments(userId: string) {
  const mine = await db.select({ id: customers.id }).from(customers).where(eq(customers.userId, userId));
  if (!mine.length) return [];
  return db
    .select({
      id: appointments.id,
      token: appointments.manageToken,
      status: appointments.status,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      serviceName: appointments.serviceName,
      serviceId: appointments.serviceId,
      memberName: members.displayName,
      business: { id: businesses.id, name: businesses.name, slug: businesses.slug, photoUrl: businesses.photoUrl, timezone: businesses.timezone, address: businesses.address, postalCode: businesses.postalCode, city: businesses.city, phone: businesses.phone, locationMode: businesses.locationMode, pausedAt: businesses.pausedAt },
    })
    .from(appointments)
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .leftJoin(members, eq(members.id, appointments.memberId))
    .where(and(inArray(appointments.customerId, mine.map((c) => c.id)), eq(appointments.kind, "appointment"), isNull(businesses.deletedAt)))
    .orderBy(desc(appointments.startsAt))
    .limit(300);
}

export async function listMyReviews(userId: string) {
  return db
    .select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt, business: { id: businesses.id, name: businesses.name, slug: businesses.slug } })
    .from(reviews)
    .innerJoin(businesses, eq(businesses.id, reviews.businessId))
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.createdAt));
}

/** Peut-on laisser un avis ? Pas sur son propre établissement ; un seul avis par établissement. */
export async function reviewEligibility(userId: string, businessId: string) {
  const [[member], [existing]] = await Promise.all([
    db.select({ id: members.id }).from(members).where(and(eq(members.businessId, businessId), eq(members.userId, userId), eq(members.status, "active"))).limit(1),
    db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.businessId, businessId), eq(reviews.userId, userId))).limit(1),
  ]);
  if (member) return { ok: false as const, reason: "own" as const };
  if (existing) return { ok: false as const, reason: "done" as const, reviewId: existing.id };
  return { ok: true as const };
}



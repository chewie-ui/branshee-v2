import "server-only";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, businesses, clientShares, customers, members, reviews, salesDocuments, shopOrders, users } from "@/db/schema";
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

/**
 * Compte dont l'adresse VÉRIFIÉE est cet email (pour relier une fiche client créée par un pro à un compte existant).
 * Comptes de démonstration et désactivés exclus.
 */
export async function verifiedAccountFor(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email.toLowerCase()}`, isNotNull(users.emailVerifiedAt), eq(users.isDemo, false), isNull(users.disabledAt)))
    .limit(1);
  return u?.id ?? null;
}

/** Utilisateur connecté de l'espace client ; adresse non vérifiée → page de vérification. */
export async function requireClient(next = "/espace-client") {
  const s = await getSessionUser();
  if (!s) redirect(`/connexion?suite=${encodeURIComponent(next)}`);
  if (!s.user.emailVerifiedAt) redirect(`/verifier-email?suite=${encodeURIComponent(next)}`);
  // Fiches créées depuis la dernière visite par un pro, avec cet email : rattachées au compte.
  await linkCustomerRecords(s.user.id, s.user.email);
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
      noShow: appointments.noShow,
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



/**
 * Commandes en ligne (boutique, click & collect) passées avec l'adresse VÉRIFIÉE du compte.
 * Les commandes en attente de paiement abandonnées (plus de 2 jours) ne sont pas montrées.
 */
export async function listMyOrders(email: string) {
  return db
    .select({ id: shopOrders.id, number: shopOrders.number, status: shopOrders.status, fulfilment: shopOrders.fulfilment, totalCents: shopOrders.totalCents, token: shopOrders.token, createdAt: shopOrders.createdAt, lines: shopOrders.lines, invoiceId: shopOrders.invoiceId, business: { name: businesses.name, slug: businesses.slug, photoUrl: businesses.photoUrl } })
    .from(shopOrders)
    .innerJoin(businesses, eq(businesses.id, shopOrders.businessId))
    .where(and(sql`lower(${shopOrders.email}) = ${email.toLowerCase()}`, isNull(businesses.deletedAt), sql`not (${shopOrders.status} = 'pending_payment' and ${shopOrders.createdAt} < now() - interval '2 days')`))
    .orderBy(desc(shopOrders.createdAt))
    .limit(60);
}


/**
 * Factures et notes de crédit émises au client, chez tous les pros, depuis toujours.
 * Fiches rattachées à son compte (email vérifié) ; brouillons et devis exclus.
 */
export async function listMyInvoices(userId: string) {
  return db
    .select({ id: salesDocuments.id, docType: salesDocuments.docType, status: salesDocuments.status, number: salesDocuments.number, issueDate: salesDocuments.issueDate, dueDate: salesDocuments.dueDate, ttcCents: salesDocuments.ttcCents, business: { name: businesses.name, photoUrl: businesses.photoUrl } })
    .from(salesDocuments)
    .innerJoin(customers, eq(customers.id, salesDocuments.customerId))
    .innerJoin(businesses, eq(businesses.id, salesDocuments.businessId))
    .where(and(eq(customers.userId, userId), inArray(salesDocuments.docType, ["invoice", "credit"]), isNotNull(salesDocuments.number), ne(salesDocuments.status, "draft"), isNull(businesses.deletedAt)))
    .orderBy(desc(salesDocuments.issueDate), desc(salesDocuments.seq));
}

/** Une facture du client (même contrôle que la liste), pour le PDF. */
export async function myInvoice(userId: string, id: string) {
  const [d] = await db
    .select({ d: salesDocuments })
    .from(salesDocuments)
    .innerJoin(customers, eq(customers.id, salesDocuments.customerId))
    .where(and(eq(salesDocuments.id, id), eq(customers.userId, userId), inArray(salesDocuments.docType, ["invoice", "credit"]), isNotNull(salesDocuments.number), ne(salesDocuments.status, "draft")));
  return d?.d ?? null;
}

/** Notes et fichiers que les pros ont partagés avec le client (fiches rattachées à son compte). */
export async function listMyShares(userId: string) {
  return db
    .select({ s: clientShares, business: { name: businesses.name, photoUrl: businesses.photoUrl, timezone: businesses.timezone } })
    .from(clientShares)
    .innerJoin(customers, eq(customers.id, clientShares.customerId))
    .innerJoin(businesses, eq(businesses.id, clientShares.businessId))
    .where(and(eq(customers.userId, userId), isNull(businesses.deletedAt)))
    .orderBy(desc(clientShares.createdAt))
    .limit(300);
}

export async function myShare(userId: string, id: string) {
  const [r] = await db.select({ s: clientShares }).from(clientShares).innerJoin(customers, eq(customers.id, clientShares.customerId)).where(and(eq(clientShares.id, id), eq(customers.userId, userId)));
  return r?.s ?? null;
}

/** Le client a vu ses partages : le pro voit « vu par le client ». */
export async function markSharesSeen(ids: string[]) {
  if (ids.length) await db.update(clientShares).set({ seenAt: new Date() }).where(and(inArray(clientShares.id, ids), isNull(clientShares.seenAt)));
}

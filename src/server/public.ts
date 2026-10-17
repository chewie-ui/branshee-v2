import "server-only";
import { cache } from "react";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { serviceMatches } from "@/lib/intake";
import { listIntake } from "@/server/intake";
import { bookingPageSettings, bookingSettings, businesses, formQuestions, members, serviceCategories, serviceMembers, services, weeklyHours } from "@/db/schema";

/**
 * Données publiques d'un établissement, pour sa page de réservation.
 * Ne sélectionne que des champs destinés à être vus par tout le monde.
 */
export const getPublicBusiness = cache(async (slug: string) => {
  const [biz] = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      businessType: businesses.businessType,
      description: businesses.description,
      photoUrl: businesses.photoUrl,
      email: businesses.email,
      phone: businesses.phone,
      website: businesses.website,
      address: businesses.address,
      postalCode: businesses.postalCode,
      city: businesses.city,
      timezone: businesses.timezone,
      pausedAt: businesses.pausedAt,
    })
    .from(businesses)
    .where(and(eq(businesses.slug, slug.toLowerCase()), isNull(businesses.deletedAt)));
  if (!biz) return null;

  const [settings] = await db.select().from(bookingSettings).where(eq(bookingSettings.businessId, biz.id));
  const [page] = await db.select({ theme: bookingPageSettings.theme, faq: bookingPageSettings.faq, categoryStyle: bookingPageSettings.categoryStyle }).from(bookingPageSettings).where(eq(bookingPageSettings.businessId, biz.id));

  const [svc, cats, links, team, questions, hours, intakeAll] = await Promise.all([
    db
      .select({ id: services.id, name: services.name, color: services.color, description: services.description, priceCents: services.priceCents, durationMin: services.durationMin, durationMaxMin: services.durationMaxMin, categoryId: services.categoryId, kind: services.kind, capacity: services.capacity, audience: services.audience, imageUrl: services.imageUrl, location: services.location })
      .from(services)
      .where(and(eq(services.businessId, biz.id), eq(services.isActive, true)))
      .orderBy(asc(services.position), asc(services.name)),
    db.select({ id: serviceCategories.id, name: serviceCategories.name, icon: serviceCategories.icon }).from(serviceCategories).where(eq(serviceCategories.businessId, biz.id)).orderBy(asc(serviceCategories.position)),
    db.select({ serviceId: serviceMembers.serviceId, memberId: serviceMembers.memberId }).from(serviceMembers).innerJoin(services, eq(services.id, serviceMembers.serviceId)).where(eq(services.businessId, biz.id)),
    db
      .select({ id: members.id, name: members.displayName, photoUrl: members.photoUrl, roleLabel: members.roleLabel, showRole: members.showRole, bio: members.bio })
      .from(members)
      .where(and(eq(members.businessId, biz.id), eq(members.status, "active"), eq(members.isActive, true), eq(members.isBookable, true)))
      .orderBy(asc(members.createdAt)),
    db.select({ id: formQuestions.id, label: formQuestions.label, type: formQuestions.type, isRequired: formQuestions.isRequired, options: formQuestions.options }).from(formQuestions).where(eq(formQuestions.businessId, biz.id)).orderBy(asc(formQuestions.position)),
    db.select({ weekday: weeklyHours.weekday, start: weeklyHours.startTime, end: weeklyHours.endTime }).from(weeklyHours).where(and(eq(weeklyHours.businessId, biz.id), isNull(weeklyHours.memberId))).orderBy(asc(weeklyHours.startTime)),
    listIntake(biz.id),
  ]);

  const teamIds = new Set(team.map((m) => m.id));
  // Cours collectifs : on réserve une séance planifiée, pas un praticien → pas de filtre sur l'équipe.
  const servicesWithMembers = svc
    .map((s) => {
      if (s.kind === "group") return { ...s, memberIds: [] as string[] };
      const restricted = links.filter((l) => l.serviceId === s.id && teamIds.has(l.memberId)).map((l) => l.memberId);
      return { ...s, memberIds: restricted.length ? restricted : [...teamIds] };
    })
    .filter((s) => s.kind === "group" || s.memberIds.length > 0);

  // Questionnaire : on ne garde que les liens vers des prestations réellement réservables.
  const publicIds = new Set(servicesWithMembers.map((s) => s.id));
  const intake = intakeAll
    .map((q) => ({ ...q, options: q.options.map((o) => ({ ...o, serviceIds: o.serviceIds.filter((id) => publicIds.has(id)) })) }))
    .filter((q) => q.options.some((o) => o.serviceIds.length > 0));

  return {
    business: biz,
    intake,
    settings: settings ? { waitlistEnabled: settings.waitlistEnabled, minLeadMin: settings.minLeadMin, phoneRequired: settings.phoneRequired, autoConfirm: settings.autoConfirm, horizonDays: settings.horizonDays, scheduleMode: settings.scheduleMode, firstVisitQuestion: settings.firstVisitQuestion } : null,
    services: servicesWithMembers,
    categories: cats,
    team: team.map((m) => ({ id: m.id, name: m.name, photoUrl: m.photoUrl, role: m.showRole ? m.roleLabel : null, bio: m.bio })),
    questions,
    accentColor: page?.theme.accentColor ?? null,
    faq: page?.faq ?? [],
    categoryStyle: page?.categoryStyle ?? "pills",
    /** Horaires communs (affichés seulement en mode « partagé »). */
    hours: settings?.scheduleMode === "shared" ? hours.map((h) => ({ weekday: h.weekday, start: h.start.slice(0, 5), end: h.end.slice(0, 5) })) : [],
  };
});

export type PublicBusiness = NonNullable<Awaited<ReturnType<typeof getPublicBusiness>>>;

/**
 * Vérifie côté serveur que la prestation choisie correspond aux réponses du questionnaire,
 * et renvoie ces réponses en clair pour les joindre au rendez-vous.
 */
export function checkIntake(data: PublicBusiness, serviceId: string, answers: Record<string, string>): { ok: true; lines: { question: string; answer: string }[] } | { ok: false } {
  const lines: { question: string; answer: string }[] = [];
  for (const q of data.intake) {
    const option = q.options.find((o) => o.id === answers[q.id]);
    if (option) lines.push({ question: q.question, answer: option.label });
  }
  return serviceMatches(serviceId, data.intake, answers) ? { ok: true, lines } : { ok: false };
}

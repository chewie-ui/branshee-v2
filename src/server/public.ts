import "server-only";
import { cache } from "react";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bookingSettings, businesses, formQuestions, members, serviceCategories, serviceMembers, services, weeklyHours } from "@/db/schema";

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

  const [svc, cats, links, team, questions, hours] = await Promise.all([
    db
      .select({ id: services.id, name: services.name, color: services.color, description: services.description, priceCents: services.priceCents, durationMin: services.durationMin, durationMaxMin: services.durationMaxMin, categoryId: services.categoryId, kind: services.kind, audience: services.audience })
      .from(services)
      .where(and(eq(services.businessId, biz.id), eq(services.isActive, true)))
      .orderBy(asc(services.position), asc(services.name)),
    db.select({ id: serviceCategories.id, name: serviceCategories.name }).from(serviceCategories).where(eq(serviceCategories.businessId, biz.id)).orderBy(asc(serviceCategories.position)),
    db.select({ serviceId: serviceMembers.serviceId, memberId: serviceMembers.memberId }).from(serviceMembers).innerJoin(services, eq(services.id, serviceMembers.serviceId)).where(eq(services.businessId, biz.id)),
    db
      .select({ id: members.id, name: members.displayName, photoUrl: members.photoUrl, roleLabel: members.roleLabel, showRole: members.showRole, bio: members.bio })
      .from(members)
      .where(and(eq(members.businessId, biz.id), eq(members.status, "active"), eq(members.isActive, true), eq(members.isBookable, true)))
      .orderBy(asc(members.createdAt)),
    db.select({ id: formQuestions.id, label: formQuestions.label, type: formQuestions.type, isRequired: formQuestions.isRequired, options: formQuestions.options }).from(formQuestions).where(eq(formQuestions.businessId, biz.id)).orderBy(asc(formQuestions.position)),
    db.select({ weekday: weeklyHours.weekday, start: weeklyHours.startTime, end: weeklyHours.endTime }).from(weeklyHours).where(and(eq(weeklyHours.businessId, biz.id), isNull(weeklyHours.memberId))).orderBy(asc(weeklyHours.startTime)),
  ]);

  const teamIds = new Set(team.map((m) => m.id));
  const servicesWithMembers = svc
    .filter((s) => s.kind === "individual")
    .map((s) => {
      const restricted = links.filter((l) => l.serviceId === s.id && teamIds.has(l.memberId)).map((l) => l.memberId);
      return { ...s, memberIds: restricted.length ? restricted : [...teamIds] };
    })
    .filter((s) => s.memberIds.length > 0);

  return {
    business: biz,
    settings: settings ? { phoneRequired: settings.phoneRequired, autoConfirm: settings.autoConfirm, horizonDays: settings.horizonDays, scheduleMode: settings.scheduleMode, firstVisitQuestion: settings.firstVisitQuestion } : null,
    services: servicesWithMembers,
    categories: cats,
    team: team.map((m) => ({ id: m.id, name: m.name, photoUrl: m.photoUrl, role: m.showRole ? m.roleLabel : null, bio: m.bio })),
    questions,
    /** Horaires communs (affichés seulement en mode « partagé »). */
    hours: settings?.scheduleMode === "shared" ? hours.map((h) => ({ weekday: h.weekday, start: h.start.slice(0, 5), end: h.end.slice(0, 5) })) : [],
  };
});

export type PublicBusiness = NonNullable<Awaited<ReturnType<typeof getPublicBusiness>>>;

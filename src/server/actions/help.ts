"use server";

import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, bookingSettings, businesses, members, notificationSettings, services, shopSettings, sites, weeklyHours } from "@/db/schema";
import { HELP_GUIDES, type HelpCheck } from "@/lib/help-guides";
import type { PermissionKey } from "@/lib/permissions";
import { requireContext } from "@/server/context";

export type HelpStatus = { allowed: string[]; checks: Partial<Record<HelpCheck, boolean>> };

/**
 * Bouton d'aide : les guides que ce membre peut suivre (selon ses apps et ses droits)
 * et l'avancement de chaque étape (oui / non seulement, aucune donnée client).
 */
export async function helpStatus(): Promise<HelpStatus> {
  const ctx = await requireContext();
  const allowed = HELP_GUIDES.filter((g) => (!g.needs.app || ctx.canApp(g.needs.app)) && (!g.needs.perm || ctx.member.isOwner || ctx.can(g.needs.perm as PermissionKey))).map((g) => g.key);
  const bid = ctx.business.id;
  const [[b], [svc], [hrs], [appt], [notif], [rules], [team], [site], [shop]] = await Promise.all([
    db.select({ pausedAt: businesses.pausedAt, photoUrl: businesses.photoUrl, onboarding: businesses.onboarding }).from(businesses).where(eq(businesses.id, bid)),
    db.select({ n: count() }).from(services).where(eq(services.businessId, bid)),
    db.select({ n: count() }).from(weeklyHours).where(eq(weeklyHours.businessId, bid)),
    db.select({ n: count() }).from(appointments).where(and(eq(appointments.businessId, bid), eq(appointments.kind, "appointment"))),
    db.select({ wa: notificationSettings.whatsappReminders, delay: notificationSettings.reminderDelayHours }).from(notificationSettings).where(eq(notificationSettings.businessId, bid)),
    db.select({ phone: bookingSettings.phoneRequired }).from(bookingSettings).where(eq(bookingSettings.businessId, bid)),
    db.select({ n: count() }).from(members).where(eq(members.businessId, bid)),
    db.select({ at: sites.publishedAt }).from(sites).where(eq(sites.businessId, bid)),
    db.select({ on: shopSettings.enabled }).from(shopSettings).where(eq(shopSettings.businessId, bid)),
  ]);
  return {
    allowed,
    checks: {
      hours: (hrs?.n ?? 0) > 0,
      service: (svc?.n ?? 0) > 0,
      bookingOn: !!b && !b.pausedAt,
      photo: !!b?.photoUrl,
      linkShared: !!b?.onboarding.linkSharedAt,
      firstBooking: (appt?.n ?? 0) > 0,
      emailReminders: (notif?.delay ?? 0) > 0,
      whatsappReminders: !!notif?.wa,
      phoneRequired: !!rules?.phone,
      team: (team?.n ?? 0) > 1,
      sitePublished: !!site?.at,
      shopOn: !!shop?.on,
    },
  };
}

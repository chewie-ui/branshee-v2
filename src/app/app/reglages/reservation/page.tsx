import type { Metadata } from "next";
import { featureOn } from "@/server/features";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { and, asc } from "drizzle-orm";
import { bookingSettings, members, serviceMembers, services } from "@/db/schema";
import { TeamBookingCard } from "@/components/settings/team-booking-card";
import { teamChoiceOf } from "@/lib/team-booking";
import { publicPagePath } from "@/server/brand";
import { RulesForm } from "@/components/settings/rules-form";
import { requireContext } from "@/server/context";
import { businessHas } from "@/server/plan";
import { UpgradeNotice } from "@/components/app/upgrade-notice";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("Règles de réservation · Réglages");

export default async function BookingRulesPage() {
  const ctx = await requireContext("settings.manage");
  const [s] = await db.select().from(bookingSettings).where(eq(bookingSettings.businessId, ctx.business.id));
  const advanced = await businessHas(ctx.business.id, "advancedAvailability");
  const team = await db
    .select({ id: members.id, name: members.displayName, photoUrl: members.photoUrl, role: members.roleLabel, bookable: members.isBookable })
    .from(members)
    .where(and(eq(members.businessId, ctx.business.id), eq(members.status, "active"), eq(members.isActive, true)))
    .orderBy(asc(members.createdAt));
  // Prestations réservables par personne (une prestation sans personne attitrée est faite par toute l'équipe).
  const [svc, links] = await Promise.all([
    db.select({ id: services.id }).from(services).where(and(eq(services.businessId, ctx.business.id), eq(services.isActive, true), eq(services.kind, "individual"))),
    db.select({ serviceId: serviceMembers.serviceId, memberId: serviceMembers.memberId }).from(serviceMembers).innerJoin(services, eq(services.id, serviceMembers.serviceId)).where(eq(services.businessId, ctx.business.id)),
  ]);
  const servicesOf = (memberId: string) => svc.filter((x) => { const l = links.filter((k) => k.serviceId === x.id); return !l.length || l.some((k) => k.memberId === memberId); }).length;
  const pageUrl = `${(process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "")}${await publicPagePath(ctx.business.slug)}`;
  return (
    <div className="space-y-4">
      {!advanced ? <UpgradeNotice feature="Battements et durée des créneaux" required="pro">Sans abonnement, l&apos;intervalle des créneaux et les battements restent ceux d&apos;origine ; le reste se règle librement.</UpgradeNotice> : null}
      <TeamBookingCard team={team.map((m) => ({ ...m, services: servicesOf(m.id) }))} choice={teamChoiceOf(s!.teamChoice)} pageUrl={pageUrl} />
      <RulesForm r={{ slotMode: s!.slotMode, slotIntervalMin: s!.slotIntervalMin, bufferBeforeMin: s!.bufferBeforeMin, bufferAfterMin: s!.bufferAfterMin, minLeadMin: s!.minLeadMin, horizonDays: s!.horizonDays, autoConfirm: s!.autoConfirm, phoneRequired: s!.phoneRequired, firstVisitQuestion: s!.firstVisitQuestion, allowOverbooking: s!.allowOverbooking, waitlistEnabled: s!.waitlistEnabled, smartGrouping: s!.smartGrouping }} showBuffers={await featureOn("buffer_time")} />
    </div>
  );
}

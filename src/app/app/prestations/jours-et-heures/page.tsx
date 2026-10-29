import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceHours, services } from "@/db/schema";
import { ServicesHoursBoard } from "@/components/services/services-hours-board";
import { ServiceTabs } from "@/components/services/service-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { openingBounds } from "@/server/opening";

export const metadata: Metadata = { title: "Jours et heures des prestations" };

/** Choisir en une fois quand plusieurs prestations sont proposées, dans le cadre des horaires d'ouverture. */
export default async function ServicesHoursPage() {
  const ctx = await requireContext("services.manage");
  const bid = ctx.business.id;
  const [list, hours, bounds] = await Promise.all([
    db.select({ id: services.id, name: services.name, color: services.color, isActive: services.isActive }).from(services).where(and(eq(services.businessId, bid), eq(services.kind, "individual"))).orderBy(asc(services.position), asc(services.name)),
    db.select({ serviceId: serviceHours.serviceId, weekday: serviceHours.weekday, start: serviceHours.startTime, end: serviceHours.endTime }).from(serviceHours).innerJoin(services, eq(services.id, serviceHours.serviceId)).where(eq(services.businessId, bid)).orderBy(asc(serviceHours.startTime)),
    openingBounds(bid),
  ]);
  const byService = new Map<string, Record<number, { start: string; end: string }[]>>();
  for (const h of hours) {
    const w = byService.get(h.serviceId) ?? {};
    (w[h.weekday] ??= []).push({ start: h.start.slice(0, 5), end: h.end.slice(0, 5) });
    byService.set(h.serviceId, w);
  }
  return (
    <>
      <PageHeader title="Prestations" description="Choisissez quels jours et à quelles heures chaque prestation est proposée. Sélectionnez-en plusieurs pour les régler en une fois." />
      <ServiceTabs />
      <ServicesHoursBoard services={list.map((s) => ({ ...s, hours: byService.get(s.id) ?? {} }))} bounds={bounds} />
    </>
  );
}

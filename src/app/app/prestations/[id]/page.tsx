import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Users } from "lucide-react";
import { format } from "date-fns";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { serviceHours, serviceMembers, services } from "@/db/schema";
import { NewSessionForm } from "@/components/services/group-sessions";
import { ServiceForm } from "@/components/services/service-form";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDay, formatTime, zoned } from "@/lib/time";
import { listServiceSessions } from "@/server/group-sessions";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { serviceFormData } from "@/server/services-page";

export const metadata: Metadata = { title: "Modifier la prestation" };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("services.manage");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [service] = await db.select().from(services).where(and(eq(services.id, id.data), eq(services.businessId, ctx.business.id)));
  if (!service) notFound();
  const [data, links] = await Promise.all([serviceFormData(ctx.business.id), db.select({ memberId: serviceMembers.memberId }).from(serviceMembers).where(eq(serviceMembers.serviceId, service.id))]);
  const memberIds = links.map((l) => l.memberId);
  const hours: Record<number, { start: string; end: string }[]> = {};
  for (const h of await db.select().from(serviceHours).where(eq(serviceHours.serviceId, service.id)).orderBy(serviceHours.startTime)) (hours[h.weekday] ??= []).push({ start: h.startTime.slice(0, 5), end: h.endTime.slice(0, 5) });
  const canSessions = service.kind === "group" && ctx.can("groupSessions.manage");
  const sessions = canSessions ? await listServiceSessions(service.id, new Date()) : [];
  const tz = ctx.business.timezone;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/prestations" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Prestations
      </Link>
      <PageHeader title={service.name} />
      <ServiceForm
        {...data}
        initial={{
          id: service.id,
          name: service.name,
          description: service.description ?? "",
          categoryId: service.categoryId ?? "",
          durationMin: service.durationMin,
          price: service.priceCents == null ? "" : (service.priceCents / 100).toString().replace(".", ","),
          color: service.color ?? "#4f46e5",
          audience: service.audience,
          isActive: service.isActive,
          memberIds: memberIds.length === data.team.length ? [] : memberIds,
          kind: service.kind,
          capacity: service.capacity,
          blocksIndividual: service.blocksIndividual,
          hours,
        }}
      />

      {canSessions ? (
        <div className="mt-8 scroll-mt-6 space-y-6" id="seances">
          <Card>
            <CardHeader title="Séances à venir" description="Les clients s'inscrivent à une séance depuis votre page de réservation." />
            {sessions.length === 0 ? (
              <p className="p-5 text-sm text-muted">Aucune séance planifiée. Ajoutez-en une ci-dessous.</p>
            ) : (
              <ul className="divide-y divide-border">
                {sessions.map((s) => {
                  const cap = s.capacity ?? service.capacity;
                  const full = cap != null && s.booked >= cap;
                  return (
                    <li key={s.id}>
                      <Link href={`/app/prestations/${service.id}/seances/${s.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-muted">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{formatDay(s.startsAt, tz, "EEEE d MMMM").replace(/^./, (c) => c.toUpperCase())} · {formatTime(s.startsAt, tz)}</p>
                          {s.memberName ? <p className="text-sm text-muted">Avec {s.memberName}</p> : null}
                        </div>
                        <span className={full ? "shrink-0 text-sm font-medium text-warning" : "shrink-0 text-sm text-muted"}>
                          <Users className="mr-1 inline size-4" aria-hidden="true" />
                          {s.booked}{cap ? ` / ${cap}` : ""}{full ? " · complet" : ""}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Planifier une séance" />
            <div className="p-5">
              <NewSessionForm serviceId={service.id} team={data.team} capacity={service.capacity} defaultDate={format(zoned(new Date(), tz), "yyyy-MM-dd")} />
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Repeat, Users } from "lucide-react";
import { format } from "date-fns";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { serviceHours, serviceMembers, services } from "@/db/schema";
import { NewSessionForm, RecurrenceForm } from "@/components/services/group-sessions";
import { ServiceForm } from "@/components/services/service-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay, formatTime, zoned } from "@/lib/time";
import { requireContext } from "@/server/context";
import { listServiceSessions } from "@/server/group-sessions";
import { serviceFormData } from "@/server/services-page";

export const metadata: Metadata = { title: "Modifier la prestation" };

const DAY_NAMES = ["dimanches", "lundis", "mardis", "mercredis", "jeudis", "vendredis", "samedis"];

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("services.manage");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [service] = await db.select().from(services).where(and(eq(services.id, id.data), eq(services.businessId, ctx.business.id)));
  if (!service) notFound();
  const tz = ctx.business.timezone;
  const [data, links, hourRows] = await Promise.all([
    serviceFormData(ctx.business.id),
    db.select({ memberId: serviceMembers.memberId }).from(serviceMembers).where(eq(serviceMembers.serviceId, service.id)),
    db.select().from(serviceHours).where(eq(serviceHours.serviceId, service.id)).orderBy(serviceHours.startTime),
  ]);
  const memberIds = links.map((l) => l.memberId);
  const hours: Record<number, { start: string; end: string }[]> = {};
  for (const h of hourRows) (hours[h.weekday] ??= []).push({ start: h.startTime.slice(0, 5), end: h.endTime.slice(0, 5) });

  const canSessions = service.kind === "group" && ctx.can("groupSessions.manage");
  const sessions = canSessions ? await listServiceSessions(service, new Date(), tz, 8) : [];
  const rec = service.recurrence;

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
          durationMaxMin: service.durationMaxMin,
          location: service.location ?? "",
          imageUrl: service.imageUrl,
          fee: service.cancellationFeeType && service.cancellationFeeValue != null ? { type: service.cancellationFeeType, value: service.cancellationFeeType === "amount" ? (service.cancellationFeeValue / 100).toString().replace(".", ",") : String(service.cancellationFeeValue) } : null,
        }}
      />

      {canSessions ? (
        <div className="mt-8 scroll-mt-6 space-y-6" id="seances">
          <Card>
            <CardHeader
              title="Cours récurrent"
              description={rec ? `Tous les ${rec.weekdays.map((d) => DAY_NAMES[d]).join(", ")} à ${rec.startTime}, sans date de fin.` : "Le cours a lieu chaque semaine aux mêmes jours et heure (ex. tous les lundis à 18:00)."}
            />
            <div className="p-5">
              <RecurrenceForm serviceId={service.id} initial={rec} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Ajouter une date ponctuelle" description="Un atelier, une séance en plus… avec sa propre heure de début et de fin." />
            <div className="p-5">
              <NewSessionForm serviceId={service.id} team={data.team} capacity={service.capacity} durationMin={service.durationMin} defaultDate={format(zoned(new Date(), tz), "yyyy-MM-dd")} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Prochaines séances" description="Les 8 prochaines semaines. Les clients s'inscrivent depuis votre page de réservation." />
            {sessions.length === 0 ? (
              <p className="p-5 text-sm text-muted">Aucune séance prévue. Réglez une récurrence ou ajoutez une date.</p>
            ) : (
              <ul className="divide-y divide-border">
                {sessions.map((s) => {
                  const full = s.capacity != null && s.booked >= s.capacity;
                  return (
                    <li key={s.id}>
                      <Link href={`/app/prestations/${service.id}/seances/${s.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-muted">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{formatDay(s.startsAt, tz, "EEEE d MMMM").replace(/^./, (c) => c.toUpperCase())} · {formatTime(s.startsAt, tz)}–{formatTime(s.endsAt, tz)}</p>
                          <p className="flex items-center gap-2 text-sm text-muted">
                            {s.virtual ? <span className="inline-flex items-center gap-1"><Repeat className="size-3.5" aria-hidden="true" />Récurrent</span> : null}
                            {s.memberName ? <span>Avec {s.memberName}</span> : null}
                          </p>
                        </div>
                        {full ? <Badge tone="warning">Complet</Badge> : null}
                        <span className="shrink-0 text-sm text-muted tabular-nums">
                          <Users className="mr-1 inline size-4" aria-hidden="true" />
                          {s.booked}{s.capacity ? ` / ${s.capacity}` : ""}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, Clock, Mail, Phone, UserRound, Users } from "lucide-react";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { appointments, groupSessions, members, services } from "@/db/schema";
import { CancelSessionButton, RestoreSessionButton } from "@/components/services/group-sessions";
import { isOccurrence, parseVirtualSessionId } from "@/lib/booking/recurrence";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDay, formatTime } from "@/lib/time";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Séance" };

export default async function SessionPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const ctx = await requireContext("groupSessions.view");
  const p = await params;
  const serviceId = z.uuid().safeParse(p.id);
  if (!serviceId.success) notFound();

  // Séance récurrente pas encore enregistrée : on l'affiche (vide) sans la créer ; si elle existe déjà en base, on y renvoie.
  const virtual = parseVirtualSessionId(p.sessionId);
  if (virtual) {
    const [svc] = await db.select().from(services).where(and(eq(services.id, serviceId.data), eq(services.businessId, ctx.business.id)));
    if (!svc?.recurrence || virtual.serviceId !== svc.id || !isOccurrence(svc.recurrence, virtual.startsAt, ctx.business.timezone)) notFound();
    const [stored] = await db.select({ id: groupSessions.id }).from(groupSessions).where(and(eq(groupSessions.serviceId, svc.id), eq(groupSessions.startsAt, virtual.startsAt)));
    if (stored) redirect(`/app/prestations/${svc.id}/seances/${stored.id}`);
    return <SessionView tz={ctx.business.timezone} service={svc} g={{ id: p.sessionId, startsAt: virtual.startsAt, endsAt: new Date(virtual.startsAt.getTime() + svc.durationMin * 60000), capacity: null, cancelledAt: null }} memberName={null} participants={[]} canManage={ctx.can("groupSessions.manage")} back={ctx.can("services.manage") ? `/app/prestations/${svc.id}#seances` : "/app/agenda"} backLabel={ctx.can("services.manage") ? svc.name : "Agenda"} recurring />;
  }
  const ids = z.object({ id: z.uuid(), sessionId: z.uuid() }).safeParse(p);
  if (!ids.success) notFound();

  const [row] = await db
    .select({ g: groupSessions, service: services, memberName: members.displayName })
    .from(groupSessions)
    .innerJoin(services, eq(services.id, groupSessions.serviceId))
    .leftJoin(members, eq(members.id, groupSessions.memberId))
    .where(and(eq(groupSessions.id, ids.data.sessionId), eq(services.id, ids.data.id), eq(services.businessId, ctx.business.id)));
  if (!row) notFound();
  const { g, service, memberName } = row;

  const participants = await db
    .select({ id: appointments.id, name: appointments.contactName, email: appointments.contactEmail, phone: appointments.contactPhone, customerId: appointments.customerId, noShow: appointments.noShow, createdAt: appointments.createdAt })
    .from(appointments)
    .where(and(eq(appointments.groupSessionId, g.id), ne(appointments.status, "cancelled")))
    .orderBy(asc(appointments.createdAt));

  return <SessionView tz={ctx.business.timezone} service={service} g={g} memberName={memberName} participants={participants} canManage={ctx.can("groupSessions.manage")} back={ctx.can("services.manage") ? `/app/prestations/${service.id}#seances` : "/app/agenda"} backLabel={ctx.can("services.manage") ? service.name : "Agenda"} recurring={false} />;
}

type Participant = { id: string; name: string | null; email: string | null; phone: string | null; customerId: string | null; noShow: boolean };

function SessionView({ tz, service, g, memberName, participants, canManage, back, backLabel, recurring }: { tz: string; service: { name: string; capacity: number | null }; g: { id: string; startsAt: Date; endsAt: Date; capacity: number | null; cancelledAt: Date | null }; memberName: string | null; participants: Participant[]; canManage: boolean; back: string; backLabel: string; recurring: boolean }) {
  const cap = g.capacity ?? service.capacity;
  const cancelled = g.cancelledAt != null;
  const upcoming = g.startsAt > new Date();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={back} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {backLabel}
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{service.name}</h1>
          <Badge tone="accent">Cours collectif</Badge>
          {cancelled ? <Badge tone="danger">Annulée</Badge> : null}
          {recurring ? <Badge>Récurrent</Badge> : null}
        </div>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
          <Clock className="size-4" aria-hidden="true" />
          {formatDay(g.startsAt, tz, "EEEE d MMMM yyyy").replace(/^./, (c) => c.toUpperCase())}, {formatTime(g.startsAt, tz)}–{formatTime(g.endsAt, tz)}
          {memberName ? ` · avec ${memberName}` : ""}
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Participants"
            description={`${participants.length}${cap ? ` sur ${cap} places` : ` inscrit${participants.length > 1 ? "s" : ""}`}`}
          />
          {participants.length === 0 ? (
            <p className="flex items-center gap-2 p-5 text-sm text-muted">
              <Users className="size-4" aria-hidden="true" />
              Personne n&apos;est encore inscrit.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {participants.map((pt) => (
                <li key={pt.id}>
                  <Link href={`/app/agenda/rdv/${pt.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-muted">
                    <UserRound className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{pt.name ?? "Client"}</p>
                      <p className="flex flex-wrap gap-x-3 text-sm text-muted">
                        {pt.phone ? <span className="inline-flex items-center gap-1"><Phone className="size-3.5" aria-hidden="true" />{pt.phone}</span> : null}
                        {pt.email ? <span className="inline-flex min-w-0 items-center gap-1 truncate"><Mail className="size-3.5" aria-hidden="true" />{pt.email}</span> : null}
                      </p>
                    </div>
                    {pt.noShow ? <Badge tone="warning">Absent</Badge> : null}
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {!cancelled && upcoming && canManage ? <CancelSessionButton id={g.id} booked={participants.length} /> : null}
        {cancelled && upcoming && canManage ? <RestoreSessionButton id={g.id} /> : null}
      </div>
    </div>
  );
}

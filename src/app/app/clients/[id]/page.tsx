import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appointments, customers, members } from "@/db/schema";
import { StatusBadge } from "@/components/app/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDay, formatTime } from "@/lib/time";
import { requireContext } from "@/server/context";
import { CalendarDays } from "lucide-react";

export const metadata: Metadata = { title: "Fiche client" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("customers.view");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const tz = ctx.business.timezone;

  const [customer] = await db.select().from(customers).where(and(eq(customers.id, id.data), eq(customers.businessId, ctx.business.id)));
  if (!customer) notFound();

  const history = await db
    .select({ a: appointments, memberName: members.displayName })
    .from(appointments)
    .leftJoin(members, eq(members.id, appointments.memberId))
    .where(eq(appointments.customerId, customer.id))
    .orderBy(desc(appointments.startsAt))
    .limit(100);

  const now = new Date();
  const upcoming = history.filter((h) => h.a.startsAt > now && h.a.status !== "cancelled").reverse();
  const past = history.filter((h) => h.a.startsAt <= now || h.a.status === "cancelled");
  const visits = past.filter((h) => h.a.status === "confirmed" && !h.a.noShow).length;
  const noShows = past.filter((h) => h.a.noShow).length;

  const Row = ({ h }: { h: (typeof history)[number] }) => (
    <li className="flex items-center gap-4 px-5 py-3">
      <div className="w-24 shrink-0 text-sm">
        <p className="font-medium">{formatDay(h.a.startsAt, tz, "d MMM yyyy")}</p>
        <p className="text-muted tabular-nums">{formatTime(h.a.startsAt, tz)}</p>
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-medium">{h.a.serviceName ?? "Rendez-vous"}</p>
        {h.memberName ? <p className="truncate text-muted">avec {h.memberName}</p> : null}
      </div>
      {h.a.noShow ? <Badge tone="danger">Absent</Badge> : <StatusBadge status={h.a.status} />}
    </li>
  );

  return (
    <>
      <Link href="/app/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Clients
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={customer.fullName} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {customer.fullName}
            {customer.blockedAt ? <Badge tone="danger">Bloqué</Badge> : null}
          </h1>
          <p className="text-sm text-muted">Client depuis {formatDay(customer.createdAt, tz, "MMMM yyyy")}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Coordonnées" />
            <ul className="space-y-3 p-5 text-sm">
              <li className="flex items-center gap-3">
                <Mail className="size-4 shrink-0 text-muted" aria-hidden="true" />
                {customer.email ? <a href={`mailto:${customer.email}`} className="truncate text-accent hover:text-accent-hover">{customer.email}</a> : <span className="text-muted">Pas d&apos;email</span>}
              </li>
              <li className="flex items-center gap-3">
                <Phone className="size-4 shrink-0 text-muted" aria-hidden="true" />
                {customer.phone ? <a href={`tel:${customer.phone}`} className="text-accent hover:text-accent-hover">{customer.phone}</a> : <span className="text-muted">Pas de téléphone</span>}
              </li>
            </ul>
          </Card>
          <Card className="grid grid-cols-2 divide-x divide-border">
            <div className="p-4">
              <p className="text-sm text-muted">Visites</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{visits}</p>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted">Absences</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{noShows}</p>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="À venir" />
            {upcoming.length ? <ul className="divide-y divide-border">{upcoming.map((h) => <Row key={h.a.id} h={h} />)}</ul> : <p className="px-5 py-4 text-sm text-muted">Aucun rendez-vous prévu.</p>}
          </Card>
          <Card>
            <CardHeader title="Historique" />
            {past.length ? (
              <ul className="divide-y divide-border">{past.map((h) => <Row key={h.a.id} h={h} />)}</ul>
            ) : (
              <EmptyState icon={<CalendarDays />} title="Pas encore d'historique" description="Les rendez-vous passés de ce client s'afficheront ici." />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

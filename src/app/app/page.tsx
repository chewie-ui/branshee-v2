import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarDays, Clock, Inbox, Plus, UserPlus } from "lucide-react";
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { CopyLink } from "@/components/app/copy-link";
import { RequestActions } from "@/components/app/request-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { countAppointments, listAppointments, listPendingRequests } from "@/server/appointments";
import { requireContext } from "@/server/context";
import { dayBounds, formatDay, formatTime, weekBounds } from "@/lib/time";

export const metadata: Metadata = { title: "Aujourd'hui" };

function greeting(hour: number) {
  return hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
}

export default async function TodayPage() {
  const ctx = await requireContext();
  const tz = ctx.business.timezone;
  const now = new Date();
  const today = dayBounds(now, tz);
  const week = weekBounds(now, tz);
  const canView = ctx.can("appointments.view");

  const [todayItems, pending, weekCount, newCustomers] = await Promise.all([
    canView ? listAppointments(ctx.business.id, today.start, today.end) : Promise.resolve([]),
    canView ? listPendingRequests(ctx.business.id, now) : Promise.resolve([]),
    canView ? countAppointments(ctx.business.id, week.start, week.end) : Promise.resolve(0),
    db
      .select({ n: count() })
      .from(customers)
      .where(and(eq(customers.businessId, ctx.business.id), gte(customers.createdAt, new Date(now.getTime() - 30 * 86400000))))
      .then((r) => r[0]?.n ?? 0),
  ]);

  const todayAppointments = todayItems.filter((a) => a.kind === "appointment");
  const next = todayAppointments.find((a) => a.endsAt > now);
  const firstName = ctx.user.name.split(" ")[0];
  const hour = Number(formatTime(now, tz).slice(0, 2));
  const bookingUrl = `${process.env.APP_URL ?? "https://branshee.com"}/${ctx.business.slug}`;

  const stats = [
    { label: "Rendez-vous aujourd'hui", value: todayAppointments.length, icon: CalendarCheck },
    { label: "Cette semaine", value: weekCount, icon: CalendarDays },
    { label: "Demandes à valider", value: pending.length, icon: Inbox },
    { label: "Nouveaux clients (30 j)", value: newCustomers, icon: UserPlus },
  ];

  return (
    <>
      <PageHeader
        title={`${greeting(hour)} ${firstName}`}
        description={formatDay(now, tz, "EEEE d MMMM yyyy").replace(/^./, (c) => c.toUpperCase())}
        action={ctx.can("appointments.manage") ? <ButtonLink href="/app/agenda/nouveau" icon={<Plus className="size-4" aria-hidden="true" />}>Nouveau rendez-vous</ButtonLink> : null}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">{s.label}</p>
              <s.icon className="size-4 text-muted" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {pending.length > 0 ? (
            <Card>
              <CardHeader title="Demandes à valider" description="Ces clients attendent votre confirmation." />
              <ul className="divide-y divide-border">
                {pending.map((a) => (
                  <li key={a.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link href={a.href} className="font-medium hover:underline">{a.title}</Link>
                      <p className="text-sm text-muted">
                        {formatDay(a.startsAt, tz, "EEE d MMM")} à {formatTime(a.startsAt, tz)} · {a.serviceName ?? "Rendez-vous"}
                        {a.memberName ? ` · ${a.memberName}` : ""}
                      </p>
                    </div>
                    {ctx.can("appointments.manage") ? <RequestActions id={a.id} /> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Votre journée"
              description={todayAppointments.length ? `${todayAppointments.length} rendez-vous prévus` : undefined}
              action={<Link href="/app/agenda" className="text-sm font-medium text-accent hover:text-accent-hover">Voir l&apos;agenda</Link>}
            />
            {todayItems.length === 0 ? (
              <EmptyState icon={<CalendarDays />} title="Aucun rendez-vous aujourd'hui" description="Partagez votre lien de réservation pour que vos clients réservent en ligne." />
            ) : (
              <ul className="divide-y divide-border">
                {todayItems.map((a) => {
                  const past = a.endsAt <= now;
                  const isNext = next?.id === a.id;
                  return (
                    <li key={a.id} className={`flex items-center gap-4 px-5 py-3 ${past ? "bg-surface-muted/50" : ""}`}>
                      <div className="w-14 shrink-0 text-sm tabular-nums">
                        <p className="font-semibold">{formatTime(a.startsAt, tz)}</p>
                        <p className="text-muted">{formatTime(a.endsAt, tz)}</p>
                      </div>
                      <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: a.kind === "block" ? "var(--border-strong)" : (a.color ?? "var(--accent)") }} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          <Link href={a.href} className="hover:underline">{a.title}</Link>
                        </p>
                        <p className="truncate text-sm text-muted">
                          {a.kind === "block" ? "Indisponible" : a.kind === "group" ? "Cours collectif" : a.serviceName}
                          {a.memberName ? ` · ${a.memberName}` : ""}
                        </p>
                      </div>
                      <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        {isNext ? <span className="text-xs font-medium text-accent">Prochain</span> : null}
                        {a.kind === "appointment" ? past && a.status === "confirmed" ? <Badge>Terminé</Badge> : <StatusBadge status={a.status} /> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Votre lien de réservation" description="À partager sur Google, Instagram, WhatsApp…" />
            <div className="space-y-3 p-5">
              <CopyLink url={bookingUrl} />
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Link href={`/${ctx.business.slug}`} target="_blank" className="inline-flex text-sm font-medium text-accent hover:text-accent-hover">
                  Voir ma page
                </Link>
                <Link href="/app/page-de-reservation" className="inline-flex text-sm font-medium text-muted hover:text-text">
                  Personnaliser
                </Link>
              </div>
            </div>
          </Card>

          {next ? (
            <Card className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted">
                <Clock className="size-4" aria-hidden="true" />
                Prochain rendez-vous
              </div>
              <p className="mt-2 text-lg font-semibold">{next.title}</p>
              <p className="text-sm text-muted">
                {formatTime(next.startsAt, tz)} · {next.serviceName}
              </p>
              {next.phone ? (
                <a href={`tel:${next.phone}`} className="mt-3 inline-flex text-sm font-medium text-accent hover:text-accent-hover">
                  Appeler {next.phone}
                </a>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarDays, Check, Clock, Inbox, Plus, UserPlus } from "lucide-react";
import { and, count, desc, eq, gte, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, appointments, businesses, customers, services } from "@/db/schema";
import { CopyLink } from "@/components/app/copy-link";
import { DismissOnboarding } from "@/components/app/dismiss-onboarding";
import { WelcomeCard } from "@/components/app/welcome-card";
import { RequestActions } from "@/components/app/request-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { clientWord } from "@/lib/terminology";
import { dayBounds, formatDay, formatTime, weekBounds } from "@/lib/time";
import { countAppointments, listAppointments, listPendingRequests } from "@/server/appointments";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Aujourd'hui" };

const greeting = (hour: number) => (hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir");

function ago(date: Date, now: Date) {
  const min = Math.round((now.getTime() - date.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "hier" : `il y a ${d} jours`;
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const ctx = await requireContext();
  const welcome = !!(await searchParams).bienvenue && ctx.member.isOwner;
  const bid = ctx.business.id;
  const tz = ctx.business.timezone;
  const now = new Date();
  const today = dayBounds(now, tz);
  const week = weekBounds(now, tz);
  const lastWeek = { start: new Date(week.start.getTime() - 7 * 86400000), end: week.start };
  const d30 = new Date(now.getTime() - 30 * 86400000);
  const d60 = new Date(now.getTime() - 60 * 86400000);
  const canView = ctx.can("appointments.view");
  const canManage = ctx.can("appointments.manage");
  const term = clientWord(ctx.business.businessType);
  const terms = clientWord(ctx.business.businessType, { plural: true });

  const n = (q: Promise<{ n: number }[]>) => q.then((r) => r[0]?.n ?? 0);
  const [todayItems, pending, weekCount, lastWeekCount, newCustomers, prevCustomers, upcoming, recentBookings, activity, [biz], serviceCount, bookingCount] = await Promise.all([
    canView ? listAppointments(bid, today.start, today.end) : Promise.resolve([]),
    canManage ? listPendingRequests(bid) : Promise.resolve([]),
    canView ? countAppointments(bid, week.start, week.end) : Promise.resolve(0),
    canView ? countAppointments(bid, lastWeek.start, lastWeek.end) : Promise.resolve(0),
    n(db.select({ n: count() }).from(customers).where(and(eq(customers.businessId, bid), gte(customers.createdAt, d30)))),
    n(db.select({ n: count() }).from(customers).where(and(eq(customers.businessId, bid), gte(customers.createdAt, d60), lt(customers.createdAt, d30)))),
    canView ? listAppointments(bid, today.end, new Date(today.end.getTime() + 14 * 86400000)).then((l) => l.filter((a) => a.kind === "appointment").slice(0, 5)) : Promise.resolve([]),
    canView
      ? db
          .select({ id: appointments.id, name: appointments.contactName, service: appointments.serviceName, startsAt: appointments.startsAt, createdAt: appointments.createdAt, online: isNull(appointments.createdById) })
          .from(appointments)
          .where(and(eq(appointments.businessId, bid), eq(appointments.kind, "appointment"), ne(appointments.status, "cancelled"), isNull(appointments.groupSessionId)))
          .orderBy(desc(appointments.createdAt))
          .limit(5)
      : Promise.resolve([]),
    ctx.can("logs.view") ? db.select({ id: activityLogs.id, description: activityLogs.description, actor: activityLogs.actorName, at: activityLogs.createdAt }).from(activityLogs).where(eq(activityLogs.businessId, bid)).orderBy(desc(activityLogs.createdAt)).limit(6) : Promise.resolve([]),
    db.select({ photoUrl: businesses.photoUrl, onboarding: businesses.onboarding }).from(businesses).where(eq(businesses.id, bid)),
    n(db.select({ n: count() }).from(services).where(eq(services.businessId, bid))),
    n(db.select({ n: count() }).from(appointments).where(and(eq(appointments.businessId, bid), eq(appointments.kind, "appointment")))),
  ]);

  const todayAppointments = todayItems.filter((a) => a.kind !== "block");
  const next = todayAppointments.find((a) => a.endsAt > now);
  const firstName = ctx.user.name.split(" ")[0];
  const hour = Number(formatTime(now, tz).slice(0, 2));
  const bookingUrl = `${process.env.APP_URL ?? "https://branshee.com"}/${ctx.business.slug}`;
  const expiredCount = pending.filter((p) => p.startsAt < now).length;

  const delta = (cur: number, prev: number) => (cur === prev ? null : { up: cur > prev, text: `${cur > prev ? "+" : "−"}${Math.abs(cur - prev)}` });
  const stats = [
    { label: "Aujourd'hui", value: todayAppointments.length, icon: CalendarCheck, hint: next ? `prochain à ${formatTime(next.startsAt, tz)}` : "rendez-vous" },
    { label: "Cette semaine", value: weekCount, icon: CalendarDays, delta: delta(weekCount, lastWeekCount), hint: "vs semaine dernière" },
    { label: "Demandes à valider", value: pending.length - expiredCount, icon: Inbox, hint: expiredCount ? `${expiredCount} expirée${expiredCount > 1 ? "s" : ""}` : "en attente" },
    { label: `Nouveaux ${terms} (30 j)`, value: newCustomers, icon: UserPlus, delta: delta(newCustomers, prevCustomers), hint: "vs 30 jours avant" },
  ];

  const ob = biz?.onboarding ?? {};
  const steps = [
    { done: serviceCount > 0, title: "Créez votre première prestation", desc: "Ce que vos clients pourront réserver.", href: "/app/prestations/nouvelle", cta: "Ajouter" },
    { done: !!biz?.photoUrl, title: "Ajoutez votre logo ou une photo", desc: "Il s'affiche sur votre page de réservation.", href: "/app/page-de-reservation", cta: "Ajouter" },
    { done: !!ob.linkSharedAt, title: "Partagez votre lien de réservation", desc: "Sur Google, Instagram, WhatsApp, votre site…", href: "#lien", cta: "Copier le lien" },
    { done: bookingCount > 0, title: "Recevez votre premier rendez-vous", desc: "Testez vous-même votre page pour voir ce que voit un client.", href: `/${ctx.business.slug}`, cta: "Voir ma page" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const showOnboarding = ctx.member.isOwner && !ob.dismissedAt && doneCount < steps.length;

  return (
    <>
      <PageHeader
        title={`${greeting(hour)} ${firstName}`}
        description={formatDay(now, tz, "EEEE d MMMM yyyy").replace(/^./, (c) => c.toUpperCase())}
        action={canManage ? <ButtonLink href="/app/agenda/nouveau" icon={<Plus className="size-4" aria-hidden="true" />}>Nouveau rendez-vous</ButtonLink> : null}
      />

      {welcome ? <WelcomeCard firstName={firstName} /> : null}

      {showOnboarding ? (
        <Card className="mb-6 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Bien démarrer sur Branshee</h2>
              <p className="text-sm text-muted">{doneCount} sur {steps.length} étapes terminées</p>
            </div>
            <DismissOnboarding />
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={steps.length} aria-label="Progression">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.title} className={cn("flex gap-3 rounded-xl border p-3", s.done ? "border-border bg-surface-muted/60" : "border-border")}>
                <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border", s.done ? "border-success bg-success text-white" : "border-border-strong")} aria-hidden="true">
                  {s.done ? <Check className="size-3.5" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", s.done && "text-muted line-through")}>{s.title}</p>
                  {!s.done ? (
                    <>
                      <p className="text-sm text-muted">{s.desc}</p>
                      <Link href={s.href} className="mt-1 inline-flex text-sm font-medium text-accent hover:text-accent-hover" {...(s.href.startsWith("/app") || s.href.startsWith("#") ? {} : { target: "_blank" })}>
                        {s.cta}
                      </Link>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm text-muted">{s.label}</p>
              <s.icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {s.delta ? <span className={cn("mr-1 font-medium", s.delta.up ? "text-success" : "text-danger")}>{s.delta.text}</span> : null}
              {s.hint}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {pending.length > 0 ? (
            <Card>
              <CardHeader
                title="Demandes à valider"
                description={`Ces ${terms} attendent votre confirmation.`}
                action={<Link href="/app/demandes" className="text-sm font-medium text-accent hover:text-accent-hover">Tout voir</Link>}
              />
              <ul className="divide-y divide-border">
                {pending.slice(0, 3).map((a) => (
                  <li key={a.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link href={`/app/agenda/rdv/${a.id}`} className="font-medium hover:underline">{a.title}</Link>
                      <p className="text-sm text-muted">
                        {formatDay(a.startsAt, tz, "EEE d MMM")} à {formatTime(a.startsAt, tz)} · {a.serviceName ?? "Rendez-vous"}
                        {a.memberName ? ` · ${a.memberName}` : ""}
                      </p>
                    </div>
                    <RequestActions id={a.id} expired={a.startsAt < now} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Votre journée"
              description={todayAppointments.length ? `${todayAppointments.length} rendez-vous prévus` : undefined}
              action={canView ? <Link href="/app/agenda" className="text-sm font-medium text-accent hover:text-accent-hover">Voir l&apos;agenda</Link> : null}
            />
            {todayItems.length === 0 ? (
              <EmptyState icon={<CalendarDays />} title="Aucun rendez-vous aujourd'hui" description={`Partagez votre lien de réservation pour que vos ${terms} réservent en ligne.`} />
            ) : (
              <ul className="divide-y divide-border">
                {todayItems.map((a) => {
                  const past = a.endsAt <= now;
                  return (
                    <li key={a.id} className={cn("flex items-center gap-4 px-5 py-3", past && "bg-surface-muted/50")}>
                      <div className="w-14 shrink-0 text-sm tabular-nums">
                        <p className="font-semibold">{formatTime(a.startsAt, tz)}</p>
                        <p className="text-muted">{formatTime(a.endsAt, tz)}</p>
                      </div>
                      <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: a.kind === "block" ? "var(--border-strong)" : (a.color ?? "var(--accent)") }} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium"><Link href={a.href} className="hover:underline">{a.title}</Link></p>
                        <p className="truncate text-sm text-muted">
                          {a.kind === "block" ? "Indisponible" : a.kind === "group" ? "Cours collectif" : (a.serviceName ?? "Rendez-vous")}
                          {a.memberName ? ` · ${a.memberName}` : ""}
                        </p>
                      </div>
                      <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        {next?.id === a.id ? <span className="text-xs font-medium text-accent">Prochain</span> : null}
                        {a.kind === "appointment" ? past && a.status === "confirmed" ? <Badge>Terminé</Badge> : <StatusBadge status={a.status} /> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {upcoming.length ? (
            <Card>
              <CardHeader title="Prochains rendez-vous" action={<Link href="/app/agenda" className="text-sm font-medium text-accent hover:text-accent-hover">Voir tout</Link>} />
              <ul className="divide-y divide-border">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    <Link href={a.href} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-muted">
                      <div className="w-20 shrink-0 text-sm">
                        <p className="font-medium first-letter:uppercase">{formatDay(a.startsAt, tz, "EEE d MMM")}</p>
                        <p className="text-muted tabular-nums">{formatTime(a.startsAt, tz)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{a.title}</p>
                        <p className="truncate text-sm text-muted">{a.serviceName ?? "Rendez-vous"}{a.memberName ? ` · ${a.memberName}` : ""}</p>
                      </div>
                      {a.status === "pending" ? <StatusBadge status="pending" /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <div id="lien" className="scroll-mt-6" />
            <CardHeader title="Votre lien de réservation" description="À partager sur Google, Instagram, WhatsApp…" />
            <div className="space-y-3 p-5">
              <CopyLink url={bookingUrl} trackShare />
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Link href={`/${ctx.business.slug}`} target="_blank" className="inline-flex text-sm font-medium text-accent hover:text-accent-hover">Voir ma page</Link>
                <Link href="/app/page-de-reservation" className="inline-flex text-sm font-medium text-muted hover:text-text">Personnaliser</Link>
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
              <p className="text-sm text-muted">{formatTime(next.startsAt, tz)} · {next.serviceName ?? "Rendez-vous"}</p>
              {next.phone ? <a href={`tel:${next.phone}`} className="mt-3 inline-flex text-sm font-medium text-accent hover:text-accent-hover">Appeler {next.phone}</a> : null}
            </Card>
          ) : null}

          {recentBookings.length ? (
            <Card>
              <CardHeader title="Dernières réservations" action={ctx.can("customers.view") ? <Link href="/app/clients" className="text-sm font-medium text-accent hover:text-accent-hover">{clientWord(ctx.business.businessType, { plural: true, capitalize: true })}</Link> : null} />
              <ul className="divide-y divide-border">
                {recentBookings.map((b) => (
                  <li key={b.id}>
                    <Link href={`/app/agenda/rdv/${b.id}`} className="block px-5 py-3 hover:bg-surface-muted">
                      <p className="truncate text-sm font-medium">{b.name ?? term}</p>
                      <p className="truncate text-xs text-muted">
                        {b.online ? "En ligne" : "Ajouté par l'équipe"} {ago(b.createdAt, now)} · pour le {formatDay(b.startsAt, tz, "d MMM")}
                        {b.service ? ` · ${b.service}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {activity.length ? (
            <Card>
              <CardHeader title="Activité récente" action={<Link href="/app/reglages/journal" className="text-sm font-medium text-accent hover:text-accent-hover">Journal</Link>} />
              <ul className="divide-y divide-border">
                {activity.map((l) => (
                  <li key={l.id} className="px-5 py-3">
                    <p className="text-sm">{l.description}</p>
                    <p className="text-xs text-muted">{l.actor} · {ago(l.at, now)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

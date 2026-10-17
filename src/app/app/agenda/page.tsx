import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { addDays, format } from "date-fns";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatDay, formatTime, minutesOfDay, parseIsoDay, weekBounds, zoned } from "@/lib/time";
import { listAppointments } from "@/server/appointments";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Agenda" };

const HOUR_PX = 56;
const DEFAULT_START = 8;
const DEFAULT_END = 19;

type SearchParams = Promise<{ semaine?: string; membre?: string }>;

export default async function AgendaPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireContext("appointments.view");
  const tz = ctx.business.timezone;
  const params = await searchParams;
  const ref = parseIsoDay(params.semaine) ?? new Date();
  const week = weekBounds(ref, tz);

  const team = await db
    .select({ id: members.id, name: members.displayName, color: members.calendarColor })
    .from(members)
    .where(and(eq(members.businessId, ctx.business.id), eq(members.status, "active"), eq(members.isBookable, true)))
    .orderBy(asc(members.createdAt));
  const memberFilter = team.some((m) => m.id === params.membre) ? params.membre : undefined;

  const items = await listAppointments(ctx.business.id, week.start, week.end, { memberId: memberFilter });

  // Vue « toute l'équipe » : chaque membre a sa colonne dans la journée, pour que les RDV simultanés ne se superposent pas.
  const lanes: (string | null)[] = memberFilter || team.length < 2 ? [null] : team.map((m) => m.id);
  const laneOf = (memberId: string | null) => Math.max(0, lanes.indexOf(memberId));

  // Plage horaire affichée : élargie si un RDV déborde des heures par défaut.
  let startHour = DEFAULT_START;
  let endHour = DEFAULT_END;
  for (const a of items) {
    startHour = Math.min(startHour, Math.floor(minutesOfDay(a.startsAt, tz) / 60));
    endHour = Math.max(endHour, Math.ceil(minutesOfDay(a.endsAt, tz) / 60) || 24);
  }
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
  const todayKey = format(zoned(new Date(), tz), "yyyy-MM-dd");
  const nowMin = minutesOfDay(new Date(), tz);

  const qs = (semaine: Date, membre?: string) => {
    const p = new URLSearchParams({ semaine: format(zoned(semaine, tz), "yyyy-MM-dd") });
    if (membre) p.set("membre", membre);
    return `/app/agenda?${p}`;
  };

  const rangeLabel = `${formatDay(days[0]!, tz, "d MMM")} – ${formatDay(days[6]!, tz, "d MMM yyyy")}`;

  return (
    <>
      <PageHeader
        title="Agenda"
        description={rangeLabel}
        action={
          <>
            <div className="flex items-center rounded-lg border border-border-strong bg-surface">
              <Link href={qs(addDays(week.start, -7), memberFilter)} className="flex size-10 items-center justify-center text-muted hover:text-text" aria-label="Semaine précédente">
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Link>
              <Link href={qs(new Date(), memberFilter)} className="border-x border-border px-3 text-sm leading-10 font-medium hover:bg-surface-muted">
                Aujourd&apos;hui
              </Link>
              <Link href={qs(addDays(week.start, 7), memberFilter)} className="flex size-10 items-center justify-center text-muted hover:text-text" aria-label="Semaine suivante">
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            {ctx.can("appointments.manage") ? (
              <ButtonLink href="/app/agenda/nouveau" icon={<Plus className="size-4" aria-hidden="true" />}>
                Nouveau rendez-vous
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {team.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer par membre">
          <Link href={qs(week.start)} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", !memberFilter ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border bg-surface text-muted hover:text-text")}>
            Toute l&apos;équipe
          </Link>
          {team.map((m) => (
            <Link key={m.id} href={qs(week.start, m.id)} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", memberFilter === m.id ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border bg-surface text-muted hover:text-text")}>
              {m.name}
            </Link>
          ))}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 56 + 7 * Math.max(100, lanes.length * 70) }}>
            {/* En-têtes des jours */}
            <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border">
              <div />
              {days.map((d) => {
                const key = format(zoned(d, tz), "yyyy-MM-dd");
                const isToday = key === todayKey;
                return (
                  <div key={key} className="border-l border-border px-2 py-2 text-center">
                    <p className="text-xs text-muted uppercase">{formatDay(d, tz, "EEE")}</p>
                    <p className={cn("mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full text-sm font-semibold", isToday && "bg-accent text-accent-foreground")}>{formatDay(d, tz, "d")}</p>
                  </div>
                );
              })}
            </div>

            {/* Grille horaire */}
            <div className="grid grid-cols-[56px_repeat(7,1fr)]">
              <div>
                {hours.map((h) => (
                  <div key={h} className="relative pr-2 text-right text-xs text-muted" style={{ height: HOUR_PX }}>
                    <span className="relative -top-2">{String(h).padStart(2, "0")}:00</span>
                  </div>
                ))}
              </div>
              {days.map((d) => {
                const key = format(zoned(d, tz), "yyyy-MM-dd");
                const dayItems = items.filter((a) => format(zoned(a.startsAt, tz), "yyyy-MM-dd") === key);
                return (
                  <div key={key} className="relative border-l border-border" style={{ height: hours.length * HOUR_PX }}>
                    {hours.map((h) => (
                      <div key={h} className="border-b border-border/70" style={{ height: HOUR_PX }} />
                    ))}
                    {key === todayKey && nowMin >= startHour * 60 && nowMin <= endHour * 60 ? (
                      <div className="absolute inset-x-0 z-10 h-0.5 bg-danger" style={{ top: ((nowMin - startHour * 60) / 60) * HOUR_PX }} aria-hidden="true" />
                    ) : null}
                    {dayItems.map((a) => {
                      const top = ((minutesOfDay(a.startsAt, tz) - startHour * 60) / 60) * HOUR_PX;
                      const height = Math.max(((a.endsAt.getTime() - a.startsAt.getTime()) / 3600000) * HOUR_PX - 2, 22);
                      const color = a.kind === "block" ? "#a1a1aa" : (a.color ?? "#4f46e5");
                      const content = (
                        <>
                          <p className="truncate font-semibold">{a.kind === "group" ? <Users className="mr-1 inline size-3" aria-hidden="true" /> : null}{a.title}</p>
                          {height > 34 ? (
                            <p className="truncate opacity-80">
                              {formatTime(a.startsAt, tz)} · {a.kind === "block" ? "Indisponible" : a.kind === "group" ? "Cours collectif" : a.serviceName}
                            </p>
                          ) : null}
                        </>
                      );
                      const className = cn(
                        "absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-xs leading-tight text-text",
                        a.status === "pending" && "border-dashed",
                        a.kind === "block" && "bg-[repeating-linear-gradient(135deg,#f4f4f5,#f4f4f5_6px,#e4e4e7_6px,#e4e4e7_12px)]",
                      );
                      const lane = laneOf(a.memberId);
                      const width = 100 / lanes.length;
                      const style = { top, height, left: `calc(${lane * width}% + 2px)`, width: `calc(${width}% - 4px)`, borderLeftColor: color, background: a.kind === "block" ? undefined : `${color}1f` };
                      return (
                        <Link key={a.id} href={a.href} className={cn(className, "hover:brightness-95")} style={style} title={`${a.title} — ${formatTime(a.startsAt, tz)}`}>
                          {content}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted">
        {lanes.length > 1 ? `Dans chaque journée, une colonne par membre : ${team.map((m) => m.name).join(", ")}. ` : ""}
        Bordure en pointillés : demande en attente de confirmation. Zone hachurée : créneau bloqué.
      </p>
    </>
  );
}

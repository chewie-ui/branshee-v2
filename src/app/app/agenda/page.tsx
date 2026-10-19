import type { Metadata } from "next";
import Link from "next/link";
import { Ban, ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { addDays, addMonths, format } from "date-fns";
import { and, asc, eq, max, min } from "drizzle-orm";
import { db } from "@/db";
import { members, weeklyHours } from "@/db/schema";
import { DayClickLayer } from "@/components/agenda/grid-click";
import { EventLink } from "@/components/agenda/event-hover";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatDay, formatTime, minutesOfDay, monthGridBounds, parseIsoDay, weekBounds, zoned } from "@/lib/time";
import { listAppointments, type AgendaItem } from "@/server/appointments";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Agenda" };

const DEFAULT_START = 8;
const DEFAULT_END = 19;

type SearchParams = Promise<{ semaine?: string; membre?: string; vue?: string; densite?: string }>;

const itemColor = (a: AgendaItem) => (a.kind === "block" ? "#a1a1aa" : (a.color ?? "#4f46e5"));

export default async function AgendaPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireContext("appointments.view");
  const tz = ctx.business.timezone;
  const params = await searchParams;
  const view = params.vue === "mois" ? "month" : "week";
  const compact = params.densite === "compacte";
  const HOUR_PX = compact ? 36 : 56;
  const ref = parseIsoDay(params.semaine) ?? new Date();
  const canManage = ctx.can("appointments.manage");

  const team = await db
    .select({ id: members.id, name: members.displayName, color: members.calendarColor })
    .from(members)
    .where(and(eq(members.businessId, ctx.business.id), eq(members.status, "active"), eq(members.isBookable, true)))
    .orderBy(asc(members.createdAt));
  const memberFilter = team.some((m) => m.id === params.membre) ? params.membre : undefined;

  const range: { start: Date; end: Date; monthStart?: Date } = view === "month" ? monthGridBounds(ref, tz) : weekBounds(ref, tz);
  const monthStart = range.monthStart ?? ref;
  const items = await listAppointments(ctx.business.id, range.start, range.end, { memberId: memberFilter });
  // Grille de la semaine : au moins les heures d'ouverture (communes et de chaque membre), pour pouvoir y créer un RDV.
  const [open] = await db.select({ first: min(weeklyHours.startTime), last: max(weeklyHours.endTime) }).from(weeklyHours).where(eq(weeklyHours.businessId, ctx.business.id));
  const toHour = (t: string | null, up: boolean) => (t ? (up ? Math.ceil((Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))) / 60) : Number(t.slice(0, 2))) : null);
  const openRange = { start: toHour(open?.first ?? null, false), end: open?.last && open.last >= "23:59" ? 24 : toHour(open?.last ?? null, true) };
  const dayKey = (d: Date) => format(zoned(d, tz), "yyyy-MM-dd");
  const todayKey = dayKey(new Date());

  const qs = (patch: { semaine?: Date; membre?: string | null; vue?: string; densite?: string }) => {
    const p = new URLSearchParams();
    p.set("semaine", dayKey(patch.semaine ?? ref));
    const m = patch.membre === undefined ? memberFilter : patch.membre;
    if (m) p.set("membre", m);
    const v = patch.vue ?? (view === "month" ? "mois" : "semaine");
    if (v === "mois") p.set("vue", "mois");
    const d = patch.densite ?? (compact ? "compacte" : "");
    if (d) p.set("densite", d);
    return `/app/agenda?${p}`;
  };

  const step = (n: number) => (view === "month" ? addMonths(ref, n) : addDays(ref, 7 * n));
  const label =
    view === "month"
      ? formatDay(monthStart, tz, "MMMM yyyy").replace(/^./, (c) => c.toUpperCase())
      : `${formatDay(range.start, tz, "d MMM")} – ${formatDay(addDays(range.start, 6), tz, "d MMM yyyy")}`;

  const pill = (active: boolean) => cn("rounded-full border px-3 py-1.5 text-sm font-medium", active ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border bg-surface text-muted hover:text-text");
  const seg = (active: boolean) => cn("px-3 text-sm leading-9 font-medium", active ? "bg-surface-muted text-text" : "text-muted hover:text-text");

  return (
    <>
      <PageHeader
        title="Agenda"
        description={label}
        action={
          <>
            <div className="flex items-center rounded-lg border border-border-strong bg-surface">
              <Link href={qs({ semaine: step(-1) })} className="flex size-10 items-center justify-center text-muted hover:text-text" aria-label={view === "month" ? "Mois précédent" : "Semaine précédente"}>
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Link>
              <Link href={qs({ semaine: new Date() })} className="border-x border-border px-3 text-sm leading-10 font-medium hover:bg-surface-muted">
                Aujourd&apos;hui
              </Link>
              <Link href={qs({ semaine: step(1) })} className="flex size-10 items-center justify-center text-muted hover:text-text" aria-label={view === "month" ? "Mois suivant" : "Semaine suivante"}>
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            {canManage ? (
              <>
                <ButtonLink href="/app/agenda/bloquer" variant="secondary" icon={<Ban className="size-4" aria-hidden="true" />}>
                  Bloquer
                </ButtonLink>
                <ButtonLink href="/app/agenda/nouveau" icon={<Plus className="size-4" aria-hidden="true" />}>
                  Nouveau rendez-vous
                </ButtonLink>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-border-strong bg-surface" role="group" aria-label="Vue">
          <Link href={qs({ vue: "semaine" })} className={seg(view === "week")} aria-current={view === "week" ? "page" : undefined}>Semaine</Link>
          <Link href={qs({ vue: "mois" })} className={cn(seg(view === "month"), "border-l border-border")} aria-current={view === "month" ? "page" : undefined}>Mois</Link>
        </div>
        {view === "week" ? (
          <div className="flex overflow-hidden rounded-lg border border-border-strong bg-surface" role="group" aria-label="Densité">
            <Link href={qs({ densite: "" })} className={seg(!compact)}>Confortable</Link>
            <Link href={qs({ densite: "compacte" })} className={cn(seg(compact), "border-l border-border")}>Compacte</Link>
          </div>
        ) : null}
        {team.length > 1 ? (
          <div className="flex flex-wrap gap-2 sm:ml-auto" role="group" aria-label="Filtrer par membre">
            <Link href={qs({ membre: null })} className={pill(!memberFilter)}>Toute l&apos;équipe</Link>
            {team.map((m) => (
              <Link key={m.id} href={qs({ membre: m.id })} className={pill(memberFilter === m.id)}>{m.name}</Link>
            ))}
          </div>
        ) : null}
      </div>

      {view === "month" ? <MonthView items={items} range={range} tz={tz} todayKey={todayKey} refMonth={dayKey(monthStart).slice(0, 7)} qs={qs} /> : <WeekView items={items} range={range} tz={tz} todayKey={todayKey} team={team} memberFilter={memberFilter} hourPx={HOUR_PX} canManage={canManage} openRange={openRange} />}

      <p className="mt-3 text-xs text-muted">
        {view === "week" && canManage ? "Cliquez sur un espace libre pour créer un rendez-vous ou bloquer le créneau. " : ""}
        Bordure en pointillés : demande en attente de confirmation. Zone hachurée : créneau bloqué.
      </p>
    </>
  );
}

function WeekView({ items, range, tz, todayKey, team, memberFilter, hourPx, canManage, openRange }: { items: AgendaItem[]; range: { start: Date }; tz: string; todayKey: string; team: { id: string; name: string }[]; memberFilter?: string; hourPx: number; canManage: boolean; openRange: { start: number | null; end: number | null } }) {
  // Vue « toute l'équipe » : une colonne par membre dans chaque journée, pour que les RDV simultanés ne se superposent pas.
  const lanes: (string | null)[] = memberFilter ? [memberFilter] : team.length < 2 ? [team[0]?.id ?? null] : team.map((m) => m.id);
  const laneOf = (memberId: string | null) => Math.max(0, lanes.indexOf(memberId));

  let startHour = Math.min(DEFAULT_START, openRange.start ?? DEFAULT_START);
  let endHour = Math.max(DEFAULT_END, openRange.end ?? DEFAULT_END);
  const dayOf = (d: Date) => format(zoned(d, tz), "yyyy-MM-dd");
  for (const a of items) {
    startHour = Math.min(startHour, Math.floor(minutesOfDay(a.startsAt, tz) / 60));
    // Un RDV qui finit après minuit (ex. 23:30 – 00:30) étend la grille jusqu'à minuit.
    const crossesMidnight = dayOf(a.endsAt) !== dayOf(a.startsAt);
    endHour = Math.max(endHour, crossesMidnight ? 24 : Math.ceil(minutesOfDay(a.endsAt, tz) / 60));
  }
  endHour = Math.min(24, endHour);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const days = Array.from({ length: 7 }, (_, i) => addDays(range.start, i));
  const nowMin = minutesOfDay(new Date(), tz);
  const dayKey = (d: Date) => format(zoned(d, tz), "yyyy-MM-dd");

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: 56 + 7 * Math.max(100, lanes.length * 70) }}>
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border">
            <div />
            {days.map((d) => {
              const key = dayKey(d);
              return (
                <div key={key} className="border-l border-border px-2 py-2 text-center">
                  <p className="text-xs text-muted uppercase">{formatDay(d, tz, "EEE")}</p>
                  <p className={cn("mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full text-sm font-semibold", key === todayKey && "bg-accent text-accent-foreground")}>{formatDay(d, tz, "d")}</p>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-[56px_repeat(7,1fr)]">
            <div>
              {hours.map((h) => (
                <div key={h} className="relative pr-2 pt-1 text-right text-xs leading-none text-muted tabular-nums" style={{ height: hourPx }}>
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {days.map((d) => {
              const key = dayKey(d);
              const dayItems = items.filter((a) => dayKey(a.startsAt) === key);
              return (
                <div key={key} className="relative border-l border-border" style={{ height: hours.length * hourPx }}>
                  {hours.map((h) => (
                    <div key={h} className="pointer-events-none border-b border-border/70" style={{ height: hourPx, backgroundImage: "linear-gradient(to bottom, transparent calc(50% - 0.5px), color-mix(in srgb, var(--border) 45%, transparent) calc(50% - 0.5px), color-mix(in srgb, var(--border) 45%, transparent) calc(50% + 0.5px), transparent calc(50% + 0.5px))" }} />
                  ))}
                  <DayClickLayer day={key} startHour={startHour} hourPx={hourPx} lanes={lanes} canManage={canManage} />
                  {key === todayKey && nowMin >= startHour * 60 && nowMin <= endHour * 60 ? (
                    <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-danger" style={{ top: ((nowMin - startHour * 60) / 60) * hourPx }} aria-hidden="true" />
                  ) : null}
                  {dayItems.map((a) => {
                    const top = ((minutesOfDay(a.startsAt, tz) - startHour * 60) / 60) * hourPx;
                    const height = Math.min(Math.max(((a.endsAt.getTime() - a.startsAt.getTime()) / 3600000) * hourPx - 2, 20), hours.length * hourPx - top);
                    const color = itemColor(a);
                    // Blocage de tout l'établissement : toute la largeur de la journée.
                    const fullWidth = a.kind === "block" && a.memberId === null;
                    const width = fullWidth ? 100 : 100 / lanes.length;
                    const left = fullWidth ? 0 : laneOf(a.memberId) * width;
                    return (
                      <EventLink
                        key={a.id}
                        href={a.href}
                        summary={{
                          title: a.title,
                          time: `${formatTime(a.startsAt, tz)} – ${formatTime(a.endsAt, tz)}`,
                          kindLabel: a.kind === "block" ? (a.memberId ? "Indisponible" : "Établissement fermé") : a.kind === "group" ? "Cours collectif" : null,
                          service: a.kind === "appointment" ? a.serviceName : a.kind === "group" ? a.serviceName : null,
                          member: a.memberName,
                          phone: a.kind === "appointment" ? a.phone : null,
                          note: a.internalNote && a.kind !== "block" ? a.internalNote : null,
                          status: a.status === "pending" ? "À confirmer" : null,
                          color,
                        }}
                        className={cn(
                          "absolute z-[5] overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-xs leading-tight text-text hover:brightness-95",
                          a.status === "pending" && "border-dashed",
                          a.kind === "block" && "bg-[repeating-linear-gradient(135deg,#f4f4f5,#f4f4f5_6px,#e4e4e7_6px,#e4e4e7_12px)]",
                        )}
                        style={{ top, height, left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)`, borderLeftColor: color, background: a.kind === "block" ? undefined : `${color}1f` }}
                      >
                        <p className="truncate font-semibold">
                          {a.kind === "group" ? <Users className="mr-1 inline size-3" aria-hidden="true" /> : null}
                          {a.title}
                        </p>
                        {height > 30 ? (
                          <p className="truncate opacity-80">
                            {formatTime(a.startsAt, tz)} · {a.kind === "block" ? (a.memberId ? "Indisponible" : "Établissement fermé") : a.kind === "group" ? "Cours collectif" : a.serviceName}
                          </p>
                        ) : null}
                      </EventLink>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MonthView({ items, range, tz, todayKey, refMonth, qs }: { items: AgendaItem[]; range: { start: Date; end: Date }; tz: string; todayKey: string; refMonth: string; qs: (p: { semaine?: Date; vue?: string }) => string }) {
  const days: Date[] = [];
  for (let d = range.start; d < range.end; d = addDays(d, 1)) days.push(d);
  const dayKey = (d: Date) => format(zoned(d, tz), "yyyy-MM-dd");
  const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-surface-muted">
        {weekdays.map((w) => (
          <p key={w} className="px-2 py-2 text-center text-xs font-medium text-muted uppercase">{w}</p>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = dayKey(d);
          const dayItems = items.filter((a) => dayKey(a.startsAt) === key && a.kind !== "block");
          const blocked = items.some((a) => dayKey(a.startsAt) === key && a.kind === "block");
          const outside = !key.startsWith(refMonth);
          return (
            <div key={key} className={cn("min-h-24 min-w-0 border-border p-1.5 sm:min-h-28", i % 7 !== 0 && "border-l", i >= 7 && "border-t", outside && "bg-surface-muted/60")}>
              <Link href={qs({ semaine: d, vue: "semaine" })} className={cn("mb-1 inline-flex size-7 items-center justify-center rounded-full text-sm font-medium hover:bg-surface-muted", key === todayKey && "bg-accent text-accent-foreground hover:bg-accent", outside && "text-muted")} aria-label={`Voir la semaine du ${formatDay(d, tz)}`}>
                {formatDay(d, tz, "d")}
              </Link>
              {blocked ? <span className="ml-1 inline-block size-2 rounded-full bg-border-strong align-middle" title="Créneau bloqué ce jour-là" /> : null}
              {dayItems.length ? (
                <Link href={qs({ semaine: d, vue: "semaine" })} className="block rounded bg-accent-soft px-1 py-0.5 text-center text-[11px] font-semibold text-accent-soft-foreground sm:hidden">
                  {dayItems.length}
                </Link>
              ) : null}
              <ul className="hidden space-y-0.5 sm:block">
                {dayItems.slice(0, 3).map((a) => (
                  <li key={a.id}>
                    <Link href={a.href} className={cn("block truncate rounded px-1 py-0.5 text-[11px] leading-tight hover:brightness-95 sm:text-xs", a.status === "pending" && "outline-1 outline-dashed")} style={{ background: `${itemColor(a)}1f`, outlineColor: itemColor(a) }}>
                      <span className="font-medium tabular-nums">{formatTime(a.startsAt, tz)}</span> {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
              {dayItems.length > 3 ? (
                <Link href={qs({ semaine: d, vue: "semaine" })} className="mt-0.5 hidden px-1 text-xs font-medium text-accent hover:text-accent-hover sm:block">
                  +{dayItems.length - 3}
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

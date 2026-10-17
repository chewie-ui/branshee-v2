import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { and, asc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bookingSettings, members, scheduleExceptions, weeklyHours } from "@/db/schema";
import { ExceptionForm, ExceptionList, type ExceptionRow } from "@/components/schedule/exceptions";
import { ScheduleMode } from "@/components/schedule/schedule-mode";
import { WeeklyHoursEditor } from "@/components/schedule/weekly-hours-editor";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatDay, zoned } from "@/lib/time";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Horaires" };

const hhmm = (t: string) => t.slice(0, 5);

export default async function HoursPage({ searchParams }: { searchParams: Promise<{ membre?: string }> }) {
  const ctx = await requireContext();
  const bid = ctx.business.id;
  const tz = ctx.business.timezone;
  const today = format(zoned(new Date(), tz), "yyyy-MM-dd");

  const [[settings], team] = await Promise.all([
    db.select({ scheduleMode: bookingSettings.scheduleMode }).from(bookingSettings).where(eq(bookingSettings.businessId, bid)),
    db
      .select({ id: members.id, name: members.displayName, canManageOwnTimeOff: members.canManageOwnTimeOff })
      .from(members)
      .where(and(eq(members.businessId, bid), eq(members.status, "active")))
      .orderBy(asc(members.createdAt)),
  ]);
  const mode = settings?.scheduleMode ?? "shared";

  // Membre affiché en mode « par membre » : celui demandé, sinon soi-même.
  const { membre } = await searchParams;
  const selected = mode === "per_member" ? (team.find((m) => m.id === membre) ?? team.find((m) => m.id === ctx.member.id) ?? team[0]) : undefined;
  const editingMemberId = selected?.id ?? null;

  const canEditWeek =
    editingMemberId === null
      ? ctx.can("availability.manageShared")
      : ctx.can(editingMemberId === ctx.member.id ? "availability.manageOwnSchedule" : "availability.manageOthersSchedule");

  const hours = await db
    .select()
    .from(weeklyHours)
    .where(and(eq(weeklyHours.businessId, bid), editingMemberId === null ? isNull(weeklyHours.memberId) : eq(weeklyHours.memberId, editingMemberId)))
    .orderBy(asc(weeklyHours.weekday), asc(weeklyHours.startTime));
  const week: Record<number, { start: string; end: string }[]> = {};
  for (const h of hours) (week[h.weekday] ??= []).push({ start: hhmm(h.startTime), end: hhmm(h.endTime) });

  // Congés et fermetures à venir, et à qui l'utilisateur peut en ajouter.
  const exRows = await db.select().from(scheduleExceptions).where(and(eq(scheduleExceptions.businessId, bid), gte(scheduleExceptions.date, today))).orderBy(asc(scheduleExceptions.date)).limit(200);
  const me = team.find((m) => m.id === ctx.member.id);
  const canOwnTimeOff = ctx.member.isOwner || (me?.canManageOwnTimeOff ?? ctx.can("availability.manageOwnTimeOff"));
  const canTimeOffFor = (memberId: string | null) =>
    memberId === null ? ctx.can("availability.manageShared") : memberId === ctx.member.id ? canOwnTimeOff : ctx.can("availability.manageOthersTimeOff");

  const nameOf = new Map(team.map((m) => [m.id, m.name]));
  const rows: ExceptionRow[] = exRows.map((e) => ({
    id: e.id,
    date: e.date,
    label: formatDay(new Date(e.date + "T12:00:00Z"), tz, "EEE d MMM"),
    who: e.memberId ? (nameOf.get(e.memberId) ?? "Ancien membre") : "Tout l'établissement",
    isClosed: e.isClosed,
    hours: e.isClosed ? null : e.hours.map((h) => `${h.start}–${h.end}`).join(", "),
    reason: e.reason,
    canDelete: canTimeOffFor(e.memberId),
  }));
  const targets = [
    ...(canTimeOffFor(null) ? [{ value: "", label: "Tout l'établissement" }] : []),
    ...team.filter((m) => canTimeOffFor(m.id)).map((m) => ({ value: m.id, label: m.id === ctx.member.id ? `${m.name} (moi)` : m.name })),
  ];

  return (
    <>
      <PageHeader title="Horaires" description="Les créneaux proposés à vos clients suivent ces horaires, moins les congés et les rendez-vous déjà pris." />

      <div className="space-y-6">
        {team.length > 1 ? <ScheduleMode value={mode} canEdit={ctx.can("availability.manageShared")} /> : null}

        <Card className="overflow-hidden">
          <CardHeader
            title={mode === "shared" ? "Horaires de la semaine" : `Horaires de ${selected?.name ?? ""}`}
            description={mode === "shared" ? "Valables pour toute l'équipe." : "Chaque membre a sa propre grille."}
          />
          {mode === "per_member" && team.length > 1 ? (
            <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3" role="group" aria-label="Choisir le membre">
              {team.map((m) => (
                <Link
                  key={m.id}
                  href={`/app/horaires?membre=${m.id}`}
                  aria-current={m.id === selected?.id ? "true" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium",
                    m.id === selected?.id ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border bg-surface text-muted hover:text-text",
                  )}
                >
                  {m.name}
                  {m.id === ctx.member.id ? " (moi)" : ""}
                </Link>
              ))}
            </div>
          ) : null}
          <WeeklyHoursEditor key={`${mode}-${editingMemberId}`} memberId={editingMemberId} initial={week} canEdit={canEditWeek} />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Congés et fermetures" description="Jours fériés, vacances, formation ou horaires exceptionnels." />
          {targets.length > 0 ? (
            <details className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center px-5 py-3 text-sm font-medium text-accent hover:text-accent-hover [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">+ Ajouter un congé ou une fermeture</span>
                <span className="hidden group-open:inline">Fermer le formulaire</span>
              </summary>
              <ExceptionForm targets={targets} today={today} />
            </details>
          ) : null}
          <ExceptionList rows={rows} />
        </Card>
      </div>
    </>
  );
}

import { appPagePath } from "@/lib/brand";
import type { Metadata } from "next";
import { format } from "date-fns";
import { and, asc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bookingSettings, members, scheduleExceptions, weeklyHours } from "@/db/schema";
import { ExceptionForm, ExceptionList, type ExceptionRow } from "@/components/schedule/exceptions";
import { ScheduleMode } from "@/components/schedule/schedule-mode";
import { MemberHours, type HoursGrid } from "@/components/schedule/member-hours";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay, zoned } from "@/lib/time";
import { requireContext } from "@/server/context";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Horaires");

const hhmm = (t: string) => t.slice(0, 5);

export default async function HoursPage({ searchParams }: { searchParams: Promise<{ membre?: string }> }) {
  const t = await appT();
  const ctx = await requireContext();
  const bid = ctx.business.id;
  const tz = ctx.business.timezone;
  const today = format(zoned(new Date(), tz), "yyyy-MM-dd");

  const [[settings], team] = await Promise.all([
    db.select({ scheduleMode: bookingSettings.scheduleMode, slotIntervalMin: bookingSettings.slotIntervalMin }).from(bookingSettings).where(eq(bookingSettings.businessId, bid)),
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

  const canEditFor = (memberId: string | null) =>
    memberId === null ? ctx.can("availability.manageShared") : ctx.can(memberId === ctx.member.id ? "availability.manageOwnSchedule" : "availability.manageOthersSchedule");

  // Toutes les grilles d'un coup (une requête) : le passage d'un membre à l'autre se fait sans recharger la page.
  const hours = await db
    .select()
    .from(weeklyHours)
    .where(and(eq(weeklyHours.businessId, bid), mode === "per_member" ? isNotNull(weeklyHours.memberId) : isNull(weeklyHours.memberId)))
    .orderBy(asc(weeklyHours.weekday), asc(weeklyHours.startTime));
  const weekOf = (memberId: string | null) => {
    const week: Record<number, { start: string; end: string }[]> = {};
    for (const h of hours) if ((h.memberId ?? null) === memberId) (week[h.weekday] ??= []).push({ start: hhmm(h.startTime), end: hhmm(h.endTime) });
    return week;
  };
  const grids: HoursGrid[] =
    mode === "per_member"
      ? team.map((m) => ({ id: m.id, name: m.name, isMe: m.id === ctx.member.id, week: weekOf(m.id), canEdit: canEditFor(m.id) }))
      : [{ id: null, name: "", isMe: false, week: weekOf(null), canEdit: canEditFor(null) }];
  const interval = settings?.slotIntervalMin ?? 30;

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
    label: formatDay(new Date(e.date + "T12:00:00Z"), tz, "EEE d MMM", t.locale),
    who: e.memberId ? (nameOf.get(e.memberId) ?? t("Ancien membre")) : t("Tout l'établissement"),
    isClosed: e.isClosed,
    hours: e.isClosed ? null : e.hours.map((h) => `${h.start}–${h.end}`).join(", "),
    reason: e.reason,
    canDelete: canTimeOffFor(e.memberId),
  }));
  const targets = [
    ...(canTimeOffFor(null) ? [{ value: "", label: t("Tout l'établissement") }] : []),
    ...team.filter((m) => canTimeOffFor(m.id)).map((m) => ({ value: m.id, label: m.id === ctx.member.id ? `${m.name} (moi)` : m.name })),
  ];

  return (
    <>
      <PageHeader title={t("Horaires")} description={t("Les créneaux proposés à vos clients suivent ces horaires, moins les congés et les rendez-vous déjà pris.")} />

      <div className="space-y-6">
        {team.length > 1 ? <ScheduleMode value={mode} canEdit={ctx.can("availability.manageShared")} /> : null}

        <Card className="overflow-hidden">
          <MemberHours mode={mode} grids={grids} initialId={editingMemberId} interval={interval} previewHref={appPagePath(ctx.business.slug)} />
        </Card>

        <Card className="overflow-hidden" data-tour="exceptions">
          <CardHeader title={t("Congés et fermetures")} description={t("Jours fériés, vacances, formation ou horaires exceptionnels.")} />
          {targets.length > 0 ? (
            <details className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center px-5 py-3 text-sm font-medium text-accent hover:text-accent-hover [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">{t("+ Ajouter un congé ou une fermeture")}</span>
                <span className="hidden group-open:inline">{t("Fermer le formulaire")}</span>
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

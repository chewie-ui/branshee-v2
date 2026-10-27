import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Timesheet } from "@/components/projects/timesheet";
import { DAY_SHORT, addDays, dayNum, isDay, isoWeek, mondayOf, todayIn, weekDays, weekRangeLabel } from "@/lib/planning";
import { fmtMinutes } from "@/lib/projects";
import { requireContext } from "@/server/context";
import { activeProjectsWithTasks, entriesOf } from "@/server/projects";

export const metadata: Metadata = { title: "Mon temps" };

/** Feuille de temps de la semaine : ce que j'ai noté, jour par jour, et saisie rapide. */
export default async function TimesheetPage({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const ctx = await requireContext();
  const today = todayIn(ctx.business.timezone);
  const q = (await searchParams).semaine;
  const monday = mondayOf(isDay(q) ? q : today);
  const days = weekDays(monday);
  const [entries, projects] = await Promise.all([entriesOf(ctx.business.id, ctx.member.id, days[0]!, days[6]!), activeProjectsWithTasks(ctx.business.id)]);
  const total = entries.reduce((a, e) => a + e.minutes, 0);
  return (
    <>
      <PageHeader title="Mon temps" description={`Semaine ${isoWeek(monday)} · ${weekRangeLabel(monday)} · ${fmtMinutes(total)}`} />
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/app/projets/temps?semaine=${addDays(monday, -7)}`} className="flex size-10 items-center justify-center rounded-lg border border-border-strong hover:bg-surface-muted" aria-label="Semaine précédente"><ChevronLeft className="size-4" aria-hidden="true" /></Link>
        <Link href="/app/projets/temps" className="inline-flex h-10 items-center rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted">Cette semaine</Link>
        <Link href={`/app/projets/temps?semaine=${addDays(monday, 7)}`} className="flex size-10 items-center justify-center rounded-lg border border-border-strong hover:bg-surface-muted" aria-label="Semaine suivante"><ChevronRight className="size-4" aria-hidden="true" /></Link>
      </div>
      <div className="mb-4 grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((d, i) => {
          const m = entries.filter((e) => e.day === d).reduce((a, e) => a + e.minutes, 0);
          return <Card key={d} className={`p-2 text-center sm:p-3 ${d === today ? "border-accent" : ""}`}><p className="text-xs text-muted">{DAY_SHORT[i]} {dayNum(d)}</p><p className="mt-1 text-xs font-semibold tabular-nums sm:text-sm">{m ? fmtMinutes(m) : "—"}</p></Card>;
        })}
      </div>
      <Timesheet projects={projects} entries={entries.map((e) => ({ ...e, billed: !!e.billed }))} today={today} defaultDay={days.includes(today) ? today : days[0]!} />
    </>
  );
}

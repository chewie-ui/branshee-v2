import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn, de } from "@/lib/cn";
import { LEAVE_KINDS, belgianHolidays, datesBetween } from "@/lib/leave";
import { addDays } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { leaveMembers, listLeave } from "@/server/leave";

export const metadata: Metadata = { title: "Calendrier des congés" };

const todayIn = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const INITIAL = ["L", "M", "M", "J", "V", "S", "D"];

/** Qui est absent ce mois-ci : une ligne par personne, une colonne par jour. */
export default async function LeaveCalendar({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const ctx = await requireContext();
  const today = todayIn(ctx.business.timezone || "Europe/Brussels");
  const q = (await searchParams).mois;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q ?? "") ? q! : today.slice(0, 7);
  const first = `${month}-01`;
  const next = addDays(first, 32).slice(0, 7);
  const last = addDays(`${next}-01`, -1);
  const prev = addDays(first, -1).slice(0, 7);
  const days = datesBetween(first, last);
  const holidays = belgianHolidays(Number(month.slice(0, 4)));
  const [members, leave] = await Promise.all([leaveMembers(ctx), listLeave(ctx, { from: first, to: last, statuses: ["approved", "pending"] })]);
  const title = new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${first}T12:00:00Z`));
  const wd = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
  const absentDays = (memberId: string) => new Map(leave.filter((l) => l.memberId === memberId).flatMap((l) => datesBetween(l.start, l.end).map((d) => [d, l] as const)));

  return (
    <>
      <PageHeader title="Calendrier" description="Qui est absent, jour par jour." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-border-strong bg-surface">
          <Link href={`/app/conges/calendrier?mois=${prev}`} className="flex size-10 items-center justify-center text-muted hover:text-text" aria-label="Mois précédent"><ChevronLeft className="size-4" aria-hidden="true" /></Link>
          <Link href="/app/conges/calendrier" className="flex h-10 items-center border-x border-border px-3 text-sm font-medium hover:bg-surface-muted">Ce mois-ci</Link>
          <Link href={`/app/conges/calendrier?mois=${next}`} className="flex size-10 items-center justify-center text-muted hover:text-text" aria-label="Mois suivant"><ChevronRight className="size-4" aria-hidden="true" /></Link>
        </div>
        <p className="font-semibold capitalize">{title}</p>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-accent" aria-hidden="true" />Validé</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-accent bg-accent-soft" aria-hidden="true" />En attente</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-border-strong bg-surface-muted" aria-hidden="true" />Week-end ou férié</span>
        </div>
      </div>
      <Card className="relative overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">Absences {de(title)}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="sticky left-0 z-10 w-32 min-w-32 bg-surface px-3 py-2 text-left text-sm font-medium text-muted">Personne</th>
              {days.map((d) => (
                <th key={d} scope="col" title={holidays.get(d)} className={cn("min-w-6 px-0 py-1.5 text-center font-medium", d === today ? "text-accent" : "text-muted", holidays.has(d) || wd(d) >= 5 ? "bg-surface-muted" : "")}>
                  <span className="block">{INITIAL[wd(d)]}</span>
                  <span className={cn("block tabular-nums", d === today ? "font-bold" : "")}>{Number(d.slice(8))}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => {
              const off = absentDays(m.id);
              return (
                <tr key={m.id}>
                  <th scope="row" className="sticky left-0 z-10 max-w-32 truncate bg-surface px-3 py-2 text-left text-sm font-medium">{m.name}</th>
                  {days.map((d) => {
                    const l = off.get(d);
                    const label = l ? `${m.name} : ${LEAVE_KINDS[l.kind].label}${l.status === "pending" ? " (en attente)" : ""}${l.period !== "full" ? (l.period === "am" ? ", matin" : ", après-midi") : ""}` : undefined;
                    return (
                      <td key={d} className={cn("h-9 p-0.5", holidays.has(d) || wd(d) >= 5 ? "bg-surface-muted" : "")}>
                        {l ? <span title={label} aria-label={label} className={cn("block h-full rounded-sm", l.status === "approved" ? "bg-accent" : "border border-accent bg-accent-soft", l.period !== "full" ? "mx-auto w-1/2" : "")} /> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {[...holidays].filter(([d]) => d.startsWith(month)).length ? (
        <p className="mt-3 text-sm text-muted">Jours fériés : {[...holidays].filter(([d]) => d.startsWith(month)).map(([d, n]) => `${n} (${Number(d.slice(8))})`).join(", ")}.</p>
      ) : null}
    </>
  );
}

import type { Metadata } from "next";
import { PlanningBoard } from "@/components/planning/planning-board";
import { PageHeader } from "@/components/ui/page-header";
import { isDay, isoWeek, mondayOf, weekRangeLabel } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { planningRights, weekPlanning } from "@/server/planning";

export const metadata: Metadata = { title: "Planning" };

/** Date du jour dans le fuseau de l'établissement (AAAA-MM-JJ). */
const todayIn = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const ctx = await requireContext();
  const today = todayIn(ctx.business.timezone || "Europe/Brussels");
  const q = (await searchParams).semaine;
  const monday = mondayOf(isDay(q) ? q : today);
  const [{ members, shifts }, rights] = [await weekPlanning(ctx, monday), planningRights(ctx)];
  const origin = (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");
  return (
    <>
      <PageHeader title="Planning" description={`Semaine ${isoWeek(monday)} · ${weekRangeLabel(monday)}${rights.seeAll ? "" : " · vos horaires"}`} />
      <PlanningBoard monday={monday} today={today} members={members} shifts={shifts} canManage={rights.manage} origin={origin} />
    </>
  );
}

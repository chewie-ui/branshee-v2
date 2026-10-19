import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appointments, members } from "@/db/schema";
import { BlockForm } from "@/components/agenda/block-form";
import { PageHeader } from "@/components/ui/page-header";
import { formatTime, parseIsoDay, zoned } from "@/lib/time";
import { hhmmOf, minutesOf, parseQuickTime } from "@/lib/time-input";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Bloquer un créneau" };

type SearchParams = Promise<{ id?: string; date?: string; heure?: string; fin?: string; membre?: string }>;

export default async function BlockPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireContext("appointments.manage");
  const p = await searchParams;
  const tz = ctx.business.timezone;
  const team = await db.select({ id: members.id, name: members.displayName }).from(members).where(and(eq(members.businessId, ctx.business.id), eq(members.status, "active"), eq(members.isBookable, true))).orderBy(asc(members.createdAt));

  let initial;
  if (p.id) {
    const id = z.uuid().safeParse(p.id);
    if (!id.success) notFound();
    const [b] = await db.select().from(appointments).where(and(eq(appointments.id, id.data), eq(appointments.businessId, ctx.business.id), eq(appointments.kind, "block")));
    if (!b) notFound();
    initial = { id: b.id, date: format(zoned(b.startsAt, tz), "yyyy-MM-dd"), start: formatTime(b.startsAt, tz), end: formatTime(b.endsAt, tz), memberId: b.memberId ?? "", note: b.internalNote ?? "" };
  } else {
    const start = parseQuickTime(p.heure ?? "") ?? "12:00";
    initial = {
      id: null,
      date: parseIsoDay(p.date) ? p.date! : format(zoned(new Date(), tz), "yyyy-MM-dd"),
      start,
      end: (() => {
        const fin = parseQuickTime(p.fin ?? "");
        return fin && minutesOf(fin) > minutesOf(start) ? fin : hhmmOf(Math.min(minutesOf(start) + 60, 23 * 60 + 59));
      })(),
      memberId: team.some((m) => m.id === p.membre) ? p.membre! : team.length === 1 ? team[0]!.id : "",
      note: "",
    };
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={initial.id ? "Modifier le blocage" : "Bloquer un créneau"} description="Pendant ce créneau, personne ne peut réserver en ligne." />
      <BlockForm initial={initial} members={team} />
    </div>
  );
}

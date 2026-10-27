import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { todayIn } from "@/lib/planning";
import { followUpState, isOpen, stageLabel } from "@/lib/sales";
import { requireContext } from "@/server/context";
import { listDeals, salesRights } from "@/server/sales";

export const metadata: Metadata = { title: "Relances" };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(c / 100);
const fdate = (d: string) => new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00Z`));

/** Qui relancer aujourd'hui : en retard, du jour, cette semaine, et les pistes sans relance prévue. */
export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<{ moi?: string }> }) {
  const ctx = await requireContext();
  if (!salesRights(ctx).view) redirect("/app/acces-refuse");
  const today = todayIn(ctx.business.timezone || "Europe/Brussels");
  const mine = (await searchParams).moi === "1";
  const open = (await listDeals(ctx.business.id)).filter((d) => isOpen(d.stage) && (!mine || d.ownerMemberId === ctx.member.id));
  const week = new Date(`${today}T12:00:00Z`);
  week.setUTCDate(week.getUTCDate() + 7);
  const weekEnd = week.toISOString().slice(0, 10);
  const groups = [
    { id: "late", title: "En retard", rows: open.filter((d) => followUpState(d.nextActionDate, today) === "late") },
    { id: "today", title: "Aujourd'hui", rows: open.filter((d) => followUpState(d.nextActionDate, today) === "today") },
    { id: "week", title: "Cette semaine", rows: open.filter((d) => d.nextActionDate && d.nextActionDate > today && d.nextActionDate <= weekEnd) },
    { id: "none", title: "Sans relance prévue", rows: open.filter((d) => !d.nextActionDate) },
  ];
  const urgent = groups[0]!.rows.length + groups[1]!.rows.length;
  return (
    <>
      <PageHeader title="Relances" description={urgent ? `${urgent} piste${urgent > 1 ? "s" : ""} à relancer aujourd'hui.` : "Rien d'urgent aujourd'hui."} />
      <div className="mb-4 inline-flex rounded-lg bg-surface-muted p-1" role="group" aria-label="Pistes affichées">
        <Link href="/app/ventes/relances" aria-current={!mine ? "page" : undefined} className={cn("h-8 rounded-md px-3 text-sm leading-8 font-medium", !mine ? "bg-surface shadow-sm" : "text-muted hover:text-text")}>Toute l&apos;équipe</Link>
        <Link href="/app/ventes/relances?moi=1" aria-current={mine ? "page" : undefined} className={cn("h-8 rounded-md px-3 text-sm leading-8 font-medium", mine ? "bg-surface shadow-sm" : "text-muted hover:text-text")}>Mes pistes</Link>
      </div>
      {open.length === 0 ? (
        <Card className="p-8 text-center"><CalendarClock className="mx-auto size-10 text-muted" aria-hidden="true" /><p className="mt-3 font-medium">Aucune piste ouverte</p><p className="mt-1 text-sm text-muted">Ajoutez vos prospects dans <Link href="/app/ventes" className="font-medium text-accent hover:text-accent-hover">Ventes</Link> avec une date de relance.</p></Card>
      ) : (
        <div className="space-y-4">
          {groups.filter((g) => g.rows.length).map((g) => (
            <Card key={g.id} className="overflow-hidden">
              <h2 className={cn("border-b border-border px-5 py-3 font-semibold", g.id === "late" && "text-danger")}>{g.title} <span className="font-normal text-muted">· {g.rows.length}</span></h2>
              <ul className="divide-y divide-border">
                {g.rows.map((d) => (
                  <li key={d.id}>
                    <Link href={`/app/ventes?piste=${d.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-surface-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{d.title}</span>
                        <span className="block truncate text-sm text-muted">{[d.nextAction, d.companyName || d.contactName, stageLabel(d.stage)].filter(Boolean).join(" · ")}</span>
                      </span>
                      {d.nextActionDate ? <span className="text-sm text-muted">{fdate(d.nextActionDate)}</span> : null}
                      <span className="w-20 text-right font-medium tabular-nums">{eur(d.valueCents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

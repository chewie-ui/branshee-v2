"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { PROJECT_STATUS, colorClass, fmtMinutes, timeValue } from "@/lib/projects";
import type { ProjectCard } from "@/server/projects";
import { ProjectDialog, type CustomerOption } from "./project-form";

const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(c / 100);
const fdate = (d: string) => new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00Z`));

/** Liste des projets : avancement, temps passé (et budget), montant à facturer, échéance. */
export function ProjectsList({ projects, customers, canManage, today }: { projects: ProjectCard[]; customers: CustomerOption[]; canManage: boolean; today: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"active" | "done" | "archived">("active");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const shown = projects.filter((p) => p.status === filter);
  const toBill = projects.reduce((a, p) => a + timeValue(p.unbilledMinutes, p.hourlyRateCents), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-surface-muted p-1" role="group" aria-label="Projets affichés">
          {(Object.keys(PROJECT_STATUS) as (keyof typeof PROJECT_STATUS)[]).map((s) => (
            <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)} className={cn("h-8 rounded-md px-3 text-sm font-medium", filter === s ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>
              {PROJECT_STATUS[s]} <span className="text-muted">{projects.filter((p) => p.status === s).length}</span>
            </button>
          ))}
        </div>
        {canManage && toBill ? <p className="text-sm text-muted">À facturer : <span className="font-semibold text-text tabular-nums">{eur(toBill)}</span></p> : null}
        {canManage ? <Button className="ml-auto" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setOpen(true)}>Nouveau projet</Button> : null}
      </div>
      {msg ? <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success" role="status">{msg}</p> : null}

      {shown.length === 0 ? (
        <Card className="p-8 text-center">
          <FolderKanban className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-medium">{filter === "active" ? "Aucun projet en cours" : "Rien ici"}</p>
          {filter === "active" ? <p className="mx-auto mt-1 max-w-md text-sm text-muted">Créez un projet par client ou par chantier : découpez-le en tâches, notez le temps passé et facturez-le en un clic.</p> : null}
          {filter === "active" && canManage ? <Button className="mt-4" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setOpen(true)}>Créer un projet</Button> : null}
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => {
            const pct = p.tasks ? Math.round((p.done / p.tasks) * 100) : 0;
            const over = p.budgetMinutes ? p.minutes > p.budgetMinutes : false;
            const late = p.deadline && p.deadline < today && p.status === "active";
            return (
              <li key={p.id}>
                <Link href={`/app/projets/${p.id}`} className="block h-full rounded-xl border border-border bg-surface p-5 shadow-sm transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-1.5 size-3 shrink-0 rounded-full", colorClass(p.color))} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="truncate text-sm text-muted">{p.customerName ?? "Projet interne"}</p>
                    </div>
                    {p.deadline ? <span className={cn("inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium", late ? "bg-danger-soft text-danger" : "bg-surface-muted text-muted")}><CalendarDays className="size-3" aria-hidden="true" />{fdate(p.deadline)}</span> : null}
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted"><span>{p.done}/{p.tasks} tâche{p.tasks > 1 ? "s" : ""}</span><span>{pct} %</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                    <span className={cn("tabular-nums", over && "font-medium text-danger")}>{fmtMinutes(p.minutes)}{p.budgetMinutes ? ` / ${fmtMinutes(p.budgetMinutes)}` : ""}</span>
                    {canManage && p.unbilledMinutes && p.hourlyRateCents ? <span className="text-muted">À facturer : <span className="font-medium text-text tabular-nums">{eur(timeValue(p.unbilledMinutes, p.hourlyRateCents))}</span></span> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {open ? <ProjectDialog project={null} customers={customers} onClose={() => setOpen(false)} onDone={(t) => { setOpen(false); setMsg(t); router.refresh(); }} /> : null}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { todayIn } from "@/lib/planning";
import { TASK_STATUS, colorClass } from "@/lib/projects";
import { requireContext } from "@/server/context";
import { tasksOf } from "@/server/projects";

export const metadata: Metadata = { title: "Mes tâches" };
const fdate = (d: string) => new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00Z`));

/** Les tâches qui me sont confiées, tous projets en cours confondus, par échéance. */
export default async function MyTasksPage() {
  const ctx = await requireContext();
  const today = todayIn(ctx.business.timezone);
  const tasks = await tasksOf(ctx.business.id, ctx.member.id);
  const groups = [
    { id: "late", title: "En retard", rows: tasks.filter((t) => t.dueDate && t.dueDate < today) },
    { id: "today", title: "Aujourd'hui", rows: tasks.filter((t) => t.dueDate === today) },
    { id: "later", title: "Plus tard", rows: tasks.filter((t) => t.dueDate && t.dueDate > today) },
    { id: "none", title: "Sans date", rows: tasks.filter((t) => !t.dueDate) },
  ];
  return (
    <>
      <PageHeader title="Mes tâches" description={tasks.length ? `${tasks.length} tâche${tasks.length > 1 ? "s" : ""} à faire.` : "Rien à faire pour l'instant."} />
      {tasks.length === 0 ? <Card className="p-8 text-center text-sm text-muted">Aucune tâche ne vous est confiée dans les projets en cours. <Link href="/app/projets" className="font-medium text-accent hover:text-accent-hover">Voir les projets</Link></Card> : (
        <div className="space-y-4">
          {groups.filter((g) => g.rows.length).map((g) => (
            <Card key={g.id} className="overflow-hidden">
              <h2 className={cn("border-b border-border px-5 py-3 font-semibold", g.id === "late" && "text-danger")}>{g.title} <span className="font-normal text-muted">· {g.rows.length}</span></h2>
              <ul className="divide-y divide-border">
                {g.rows.map((t) => (
                  <li key={t.id}>
                    <Link href={`/app/projets/${t.projectId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-surface-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                      <span className={cn("size-2.5 shrink-0 rounded-full", colorClass(t.color))} aria-hidden="true" />
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{t.title}</span><span className="block truncate text-sm text-muted">{t.projectName} · {TASK_STATUS.find((s) => s.id === t.status)?.label}</span></span>
                      {t.dueDate ? <span className="inline-flex items-center gap-1 text-sm text-muted"><CalendarDays className="size-4" aria-hidden="true" />{fdate(t.dueDate)}</span> : null}
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

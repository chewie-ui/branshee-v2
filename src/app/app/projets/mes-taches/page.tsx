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
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Mes tâches");
const fdate = (d: string) => new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00Z`));

/** Les tâches qui me sont confiées, tous projets en cours confondus, par échéance. */
export default async function MyTasksPage() {
  const t = await appT();
  const ctx = await requireContext();
  const today = todayIn(ctx.business.timezone);
  const tasks = await tasksOf(ctx.business.id, ctx.member.id);
  const groups = [
    { id: "late", title: t("En retard"), rows: tasks.filter((tp) => tp.dueDate && tp.dueDate < today) },
    { id: "today", title: t("Aujourd'hui"), rows: tasks.filter((tp) => tp.dueDate === today) },
    { id: "later", title: t("Plus tard"), rows: tasks.filter((tp) => tp.dueDate && tp.dueDate > today) },
    { id: "none", title: t("Sans date"), rows: tasks.filter((tp) => !tp.dueDate) },
  ];
  return (
    <>
      <PageHeader title={t("Mes tâches")} description={tasks.length ? `${tasks.length} tâche${tasks.length > 1 ? "s" : ""} à faire.` : t("Rien à faire pour l'instant.")} />
      {tasks.length === 0 ? <Card className="p-8 text-center text-sm text-muted">{t("Aucune tâche ne vous est confiée dans les projets en cours.")} <Link href="/app/projets" className="font-medium text-accent hover:text-accent-hover">{t("Voir les projets")}</Link></Card> : (
        <div className="space-y-4">
          {groups.filter((g) => g.rows.length).map((g) => (
            <Card key={g.id} className="overflow-hidden">
              <h2 className={cn("border-b border-border px-5 py-3 font-semibold", g.id === "late" && "text-danger")}>{t(g.title)} <span className="font-normal text-muted">· {g.rows.length}</span></h2>
              <ul className="divide-y divide-border">
                {g.rows.map((tp) => (
                  <li key={tp.id}>
                    <Link href={`/app/projets/${tp.projectId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-surface-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                      <span className={cn("size-2.5 shrink-0 rounded-full", colorClass(tp.color))} aria-hidden="true" />
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{t(tp.title)}</span><span className="block truncate text-sm text-muted">{tp.projectName} · {TASK_STATUS.find((s) => s.id === tp.status)?.label}</span></span>
                      {tp.dueDate ? <span className="inline-flex items-center gap-1 text-sm text-muted"><CalendarDays className="size-4" aria-hidden="true" />{fdate(tp.dueDate)}</span> : null}
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

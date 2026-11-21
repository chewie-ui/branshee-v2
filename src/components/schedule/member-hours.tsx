"use client";

import { useState } from "react";
import Link from "next/link";
import { CardHeader } from "@/components/ui/card";
import { WeeklyHoursEditor } from "@/components/schedule/weekly-hours-editor";
import { useT } from "@/components/app-locale";
import { cn } from "@/lib/cn";

type Week = Record<number, { start: string; end: string }[]>;
export type HoursGrid = { id: string | null; name: string; isMe: boolean; week: Week; canEdit: boolean };

const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fmtH = (m: number) => `${Math.floor(m / 60)} h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;

/**
 * Grille de la semaine (commune ou par membre). En mode « par membre », les grilles de toute l'équipe sont déjà
 * chargées : passer d'un membre à l'autre est instantané (l'adresse suit, sans rechargement).
 */
export function MemberHours({ mode, grids, initialId, interval, previewHref }: { mode: "shared" | "per_member"; grids: HoursGrid[]; initialId: string | null; interval: number; previewHref: string }) {
  const t = useT();
  const [selectedId, setSelectedId] = useState(initialId);
  const g = grids.find((x) => x.id === selectedId) ?? grids[0]!;

  const pick = (id: string | null) => {
    setSelectedId(id);
    try {
      const u = new URL(window.location.href);
      if (id) u.searchParams.set("membre", id);
      else u.searchParams.delete("membre");
      window.history.replaceState(window.history.state, "", u);
    } catch {
      /* adresse non modifiable : le choix reste affiché */
    }
  };

  const ranges = Object.values(g.week).flat();
  const weekMin = ranges.reduce((n, r) => n + Math.max(0, minutesOf(r.end) - minutesOf(r.start)), 0);
  const openDays = Object.values(g.week).filter((r) => r.length).length;
  const slots = ranges.reduce((n, r) => n + Math.max(0, Math.floor((minutesOf(r.end) - minutesOf(r.start)) / interval)), 0);

  return (
    <>
      <CardHeader
        title={mode === "shared" ? t("Horaires de la semaine") : `${t("Horaires de")} ${g.name}`}
        description={mode === "shared" ? t("Valables pour toute l'équipe.") : t("Chaque membre a sa propre grille.")}
      />
      {mode === "per_member" && grids.length > 1 ? (
        <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3" role="group" aria-label={t("Choisir le membre")}>
          {grids.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m.id)}
              aria-pressed={m.id === g.id}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                m.id === g.id ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border bg-surface text-muted hover:text-text",
              )}
            >
              {m.name}
              {m.isMe ? ` ${t("(moi)")}` : ""}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-surface-muted px-5 py-3 text-sm">
        <span><strong className="tabular-nums">{openDays}</strong> {openDays > 1 ? t("jours ouverts") : t("jour ouvert")}</span>
        <span><strong className="tabular-nums">{fmtH(weekMin)}</strong> {t("par semaine")}</span>
        <span title={t("Départs possibles toutes les {n} min", { n: interval })}>≈ <strong className="tabular-nums">{slots}</strong> {t("créneaux de {n} min", { n: interval })}</span>
        <Link href={previewHref} target="_blank" className="ml-auto font-medium text-accent hover:text-accent-hover">{t("Voir comme un client ↗")}</Link>
      </div>
      <WeeklyHoursEditor key={`${mode}-${g.id}`} memberId={g.id} initial={g.week} canEdit={g.canEdit} />
    </>
  );
}

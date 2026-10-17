"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type Range = { start: string; end: string };
export type Week = Record<number, Range[]>;

// Semaine affichée du lundi au dimanche (stockage : 0 = dimanche).
export const WEEK_DAYS = [
  { wd: 1, label: "Lundi" },
  { wd: 2, label: "Mardi" },
  { wd: 3, label: "Mercredi" },
  { wd: 4, label: "Jeudi" },
  { wd: 5, label: "Vendredi" },
  { wd: 6, label: "Samedi" },
  { wd: 0, label: "Dimanche" },
];

/** Grille « un interrupteur + des plages horaires par jour », contrôlée par le parent. */
export function WeekRanges({
  value,
  onChange,
  disabled = false,
  offLabel = "Fermé",
  defaultRange = { start: "09:00", end: "18:00" },
  className,
}: {
  value: Week;
  onChange: (week: Week) => void;
  disabled?: boolean;
  offLabel?: string;
  defaultRange?: Range;
  className?: string;
}) {
  const set = (wd: number, ranges: Range[]) => onChange({ ...value, [wd]: ranges });
  const copyToWeekdays = (wd: number) => {
    const src = value[wd] ?? [];
    onChange({ ...value, 1: [...src], 2: [...src], 3: [...src], 4: [...src], 5: [...src] });
  };

  return (
    <ul className={cn("divide-y divide-border", className)}>
      {WEEK_DAYS.map(({ wd, label }) => {
        const ranges = value[wd] ?? [];
        const open = ranges.length > 0;
        return (
          <li key={wd} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
            <div className="flex w-40 shrink-0 items-center gap-3 pt-1.5">
              <button
                type="button"
                role="switch"
                aria-checked={open}
                aria-label={`${label} : ${open ? "activé" : offLabel.toLowerCase()}`}
                disabled={disabled}
                onClick={() => set(wd, open ? [] : [defaultRange])}
                className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50", open ? "bg-accent" : "bg-border-strong")}
              >
                <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", open && "translate-x-4")} />
              </button>
              <span className="text-sm font-medium">{label}</span>
            </div>

            <div className="flex-1">
              {!open ? (
                <p className="pt-1.5 text-sm text-muted">{offLabel}</p>
              ) : (
                <div className="space-y-2">
                  {ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        step={300}
                        value={r.start}
                        disabled={disabled}
                        aria-label={`${label}, plage ${i + 1}, début`}
                        onChange={(e) => set(wd, ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                        className="h-9 w-32 rounded-lg border border-border-strong bg-surface px-2 text-sm tabular-nums focus-visible:border-accent"
                      />
                      <span className="text-sm text-muted">à</span>
                      <input
                        type="time"
                        step={300}
                        value={r.end}
                        disabled={disabled}
                        aria-label={`${label}, plage ${i + 1}, fin`}
                        onChange={(e) => set(wd, ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                        className="h-9 w-32 rounded-lg border border-border-strong bg-surface px-2 text-sm tabular-nums focus-visible:border-accent"
                      />
                      {!disabled ? (
                        <button
                          type="button"
                          onClick={() => set(wd, ranges.filter((_, j) => j !== i))}
                          className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger"
                          aria-label={`Supprimer la plage ${i + 1} du ${label.toLowerCase()}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {!disabled ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                      <button
                        type="button"
                        onClick={() => set(wd, [...ranges, { start: ranges.at(-1)?.end ?? defaultRange.start, end: defaultRange.end }])}
                        disabled={ranges.length >= 6}
                        className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Ajouter une plage
                      </button>
                      {wd >= 1 && wd <= 5 ? (
                        <button type="button" onClick={() => copyToWeekdays(wd)} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-text">
                          <Copy className="size-4" aria-hidden="true" />
                          Copier du lundi au vendredi
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

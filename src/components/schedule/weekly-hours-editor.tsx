"use client";

import { useState, useTransition } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { saveWeeklyHours } from "@/server/actions/schedule";

type Range = { start: string; end: string };
type Week = Record<number, Range[]>;

// Semaine affichée du lundi au dimanche (stockage : 0 = dimanche).
const DAYS = [
  { wd: 1, label: "Lundi" },
  { wd: 2, label: "Mardi" },
  { wd: 3, label: "Mercredi" },
  { wd: 4, label: "Jeudi" },
  { wd: 5, label: "Vendredi" },
  { wd: 6, label: "Samedi" },
  { wd: 0, label: "Dimanche" },
];

export function WeeklyHoursEditor({ memberId, initial, canEdit }: { memberId: string | null; initial: Week; canEdit: boolean }) {
  const [week, setWeek] = useState<Week>(initial);
  const [saved, setSaved] = useState<Week>(initial);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(week) !== JSON.stringify(saved);

  const set = (wd: number, ranges: Range[]) => {
    setDone(false);
    setWeek((w) => ({ ...w, [wd]: ranges }));
  };

  function copyToWeekdays(wd: number) {
    const src = week[wd] ?? [];
    setDone(false);
    setWeek((w) => ({ ...w, 1: [...src], 2: [...src], 3: [...src], 4: [...src], 5: [...src] }));
  }

  function save() {
    setError(null);
    start(async () => {
      const payload = Object.fromEntries(DAYS.map((d) => [String(d.wd), week[d.wd] ?? []]));
      const res = await saveWeeklyHours(memberId, payload);
      if (res.ok) {
        setSaved(week);
        setDone(true);
      } else setError(res.error);
    });
  }

  return (
    <div>
      <ul className="divide-y divide-border">
        {DAYS.map(({ wd, label }) => {
          const ranges = week[wd] ?? [];
          const open = ranges.length > 0;
          return (
            <li key={wd} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
              <div className="flex w-40 shrink-0 items-center gap-3 pt-1.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={open}
                  aria-label={`${label} : ${open ? "ouvert" : "fermé"}`}
                  disabled={!canEdit}
                  onClick={() => set(wd, open ? [] : [{ start: "09:00", end: "18:00" }])}
                  className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50", open ? "bg-accent" : "bg-border-strong")}
                >
                  <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", open && "translate-x-4")} />
                </button>
                <span className="text-sm font-medium">{label}</span>
              </div>

              <div className="flex-1">
                {!open ? (
                  <p className="pt-1.5 text-sm text-muted">Fermé</p>
                ) : (
                  <div className="space-y-2">
                    {ranges.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          step={300}
                          value={r.start}
                          disabled={!canEdit}
                          aria-label={`${label}, plage ${i + 1}, début`}
                          onChange={(e) => set(wd, ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                          className="h-9 w-32 rounded-lg border border-border-strong bg-surface px-2 text-sm tabular-nums focus-visible:border-accent"
                        />
                        <span className="text-sm text-muted">à</span>
                        <input
                          type="time"
                          step={300}
                          value={r.end}
                          disabled={!canEdit}
                          aria-label={`${label}, plage ${i + 1}, fin`}
                          onChange={(e) => set(wd, ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                          className="h-9 w-32 rounded-lg border border-border-strong bg-surface px-2 text-sm tabular-nums focus-visible:border-accent"
                        />
                        {canEdit ? (
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
                    {canEdit ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                        <button
                          type="button"
                          onClick={() => set(wd, [...ranges, { start: ranges.at(-1)?.end ?? "09:00", end: "18:00" }])}
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

      {canEdit ? (
        <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          {error ? (
            <p className="text-sm text-danger sm:mr-auto" role="alert">
              {error}
            </p>
          ) : done && !dirty ? (
            <p className="text-sm text-success sm:mr-auto" role="status">
              Horaires enregistrés.
            </p>
          ) : null}
          {dirty ? (
            <Button variant="ghost" onClick={() => { setWeek(saved); setError(null); }} disabled={pending}>
              Annuler les changements
            </Button>
          ) : null}
          <Button onClick={save} loading={pending} disabled={!dirty}>
            Enregistrer
          </Button>
        </div>
      ) : (
        <p className="border-t border-border px-5 py-3 text-sm text-muted">Vous pouvez consulter ces horaires, mais pas les modifier.</p>
      )}
    </div>
  );
}

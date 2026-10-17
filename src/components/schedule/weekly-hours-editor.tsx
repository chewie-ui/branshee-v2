"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { WEEK_DAYS, WeekRanges, type Week } from "@/components/schedule/week-ranges";
import { saveWeeklyHours } from "@/server/actions/schedule";

export function WeeklyHoursEditor({ memberId, initial, canEdit }: { memberId: string | null; initial: Week; canEdit: boolean }) {
  const [week, setWeek] = useState<Week>(initial);
  const [saved, setSaved] = useState<Week>(initial);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(week) !== JSON.stringify(saved);

  function save() {
    setError(null);
    start(async () => {
      const payload = Object.fromEntries(WEEK_DAYS.map((d) => [String(d.wd), week[d.wd] ?? []]));
      const res = await saveWeeklyHours(memberId, payload);
      if (res.ok) {
        setSaved(week);
        setDone(true);
      } else setError(res.error);
    });
  }

  return (
    <div>
      <WeekRanges value={week} onChange={(w) => { setDone(false); setWeek(w); }} disabled={!canEdit} />

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

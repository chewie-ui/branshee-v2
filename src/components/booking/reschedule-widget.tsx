"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getRescheduleSlots, rescheduleByToken } from "@/server/actions/manage";

const utc = (d: string) => new Date(d + "T12:00:00Z");
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-BE", { ...o, timeZone: "UTC" });
const WD = fmt({ weekday: "short" });
const DN = fmt({ day: "numeric" });
const LONG = fmt({ weekday: "long", day: "numeric", month: "long" });
const addDays = (d: string, n: number) => {
  const x = utc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Déplacer son RDV soi-même : choix d'un nouveau créneau, sans jamais libérer l'ancien entre-temps. */
export function RescheduleWidget({ token, today, defaultOpen = false }: { token: string; today: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [week, setWeek] = useState(today);
  const [days, setDays] = useState<{ date: string; times: string[] }[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, startLoad] = useTransition();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    startLoad(async () => {
      const d = await getRescheduleSlots(token, week);
      setDays(d);
      setDay((cur) => (cur && d.some((x) => x.date === cur && x.times.length) ? cur : (d.find((x) => x.times.length)?.date ?? null)));
    });
  }, [open, week, token]);

  if (done) return <p className="rounded-lg bg-success-soft p-3 text-sm text-success" role="status">Rendez-vous déplacé. Vous allez recevoir un email de confirmation.</p>;
  if (!open) return <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>Déplacer le rendez-vous</Button>;
  const times = days?.find((d) => d.date === day)?.times ?? [];

  return (
    <div id="deplacer" className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Choisir un nouveau créneau</p>
        <div className="flex gap-1">
          <button type="button" disabled={week <= today || loading} onClick={() => setWeek(addDays(week, -7) < today ? today : addDays(week, -7))} className="flex size-9 items-center justify-center rounded-lg border border-border-strong text-muted disabled:opacity-40" aria-label="Semaine précédente"><ChevronLeft className="size-4" aria-hidden="true" /></button>
          <button type="button" disabled={loading} onClick={() => setWeek(addDays(week, 7))} className="flex size-9 items-center justify-center rounded-lg border border-border-strong text-muted disabled:opacity-40" aria-label="Semaine suivante"><ChevronRight className="size-4" aria-hidden="true" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Choisir un jour">
        {(days ?? Array.from({ length: 7 }, (_, i) => ({ date: addDays(week, i), times: [] }))).map((d) => (
          <button key={d.date} type="button" disabled={!d.times.length || loading} aria-pressed={d.date === day} onClick={() => { setDay(d.date); setTime(null); }} className={cn("flex min-h-14 flex-col items-center justify-center rounded-lg border text-xs disabled:cursor-not-allowed", d.date === day ? "border-accent bg-accent text-accent-foreground" : d.times.length ? "border-border-strong hover:border-accent" : "border-transparent bg-surface-muted text-muted", loading && "animate-pulse")}>
            <span className="capitalize">{WD.format(utc(d.date)).replace(".", "")}</span>
            <span className="text-sm font-semibold">{DN.format(utc(d.date))}</span>
          </button>
        ))}
      </div>
      {days && !loading ? (
        times.length ? (
          <div className="grid grid-cols-4 gap-1.5">
            {times.map((t) => (
              <button key={t} type="button" aria-pressed={t === time} onClick={() => { setTime(t); setError(null); }} className={cn("h-9 rounded-lg border text-sm font-medium tabular-nums", t === time ? "border-accent bg-accent text-accent-foreground" : "border-border-strong hover:border-accent")}>
                {t}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Aucun créneau libre cette semaine. Essayez la suivante.</p>
        )
      ) : null}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>Fermer</Button>
        <Button
          className="flex-1"
          disabled={!day || !time}
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await rescheduleByToken(token, day!, time!);
              if (r.ok) setDone(true);
              else { setError(r.error ?? "Erreur."); setWeek((w) => w); }
            })
          }
        >
          {day && time ? `Déplacer au ${LONG.format(utc(day))} à ${time}` : "Déplacer"}
        </Button>
      </div>
    </div>
  );
}

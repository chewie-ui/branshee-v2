"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { WeekRanges, type Week } from "@/components/schedule/week-ranges";
import { cn } from "@/lib/cn";
import { outsideBounds, summarize, type Week as OpeningWeek } from "@/lib/opening";
import { setServicesHours } from "@/server/actions/services";

type Svc = { id: string; name: string; color: string | null; isActive: boolean; hours: Week };

/**
 * Jours et heures des prestations en une fois : on coche une ou plusieurs prestations, on choisit
 * « toutes les heures d'ouverture » ou des jours précis, et on applique. Les jours fermés sont bloqués,
 * les heures restent dans les horaires d'ouverture.
 */
export function ServicesHoursBoard({ services, bounds }: { services: Svc[]; bounds: OpeningWeek | null }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [limited, setLimited] = useState(true);
  const [week, setWeek] = useState<Week>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const all = picked.size === services.length && services.length > 0;
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // Une seule prestation cochée : on part de ses réglages actuels.
  const pickOne = (s: Svc) => {
    setPicked(new Set([s.id]));
    const has = Object.values(s.hours).some((r) => r?.length);
    setLimited(has);
    setWeek(has ? s.hours : {});
    setMsg(null);
  };
  const empty = !Object.values(week).some((r) => r?.length);
  const problem = limited && !empty ? outsideBounds(week, bounds) : null;

  const apply = () =>
    start(async () => {
      const r = await setServicesHours([...picked], limited ? (week as Record<string, { start: string; end: string }[]>) : {});
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  if (!services.length) return <Card className="p-8 text-center text-sm text-muted">Aucune prestation individuelle pour l&apos;instant.</Card>;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card className="h-fit">
        <CardHeader title="1. Choisissez les prestations" description="Cochez-en une ou plusieurs." />
        <label className="flex cursor-pointer items-center gap-3 border-b border-border px-5 py-3 text-sm font-medium hover:bg-surface-muted/60">
          <input type="checkbox" checked={all} onChange={() => setPicked(all ? new Set() : new Set(services.map((s) => s.id)))} className="size-4 accent-[var(--accent)]" />
          Tout sélectionner
        </label>
        <ul className="divide-y divide-border">
          {services.map((s) => {
            const sum = summarize(s.hours);
            return (
              <li key={s.id} className={cn("flex items-start gap-3 px-5 py-3", picked.has(s.id) && "bg-accent-soft/50")}>
                <input id={`sh-${s.id}`} type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} className="mt-1 size-4 shrink-0 accent-[var(--accent)]" />
                <label htmlFor={`sh-${s.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="flex items-center gap-2 text-sm font-medium"><span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color ?? "#4f46e5" }} aria-hidden="true" />{s.name}{s.isActive ? null : <span className="text-xs font-normal text-muted">(masquée)</span>}</span>
                  <span className="mt-0.5 block text-xs text-muted">{sum || "Toutes les heures d'ouverture"}</span>
                </label>
                <button type="button" onClick={() => pickOne(s)} className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft">Modifier</button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader title="2. Quand sont-elles proposées ?" description={picked.size ? `${picked.size} prestation${picked.size > 1 ? "s" : ""} sélectionnée${picked.size > 1 ? "s" : ""}` : "Sélectionnez d'abord au moins une prestation."} />
        <div className="space-y-3 p-5">
          {!bounds ? (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">Vos horaires d&apos;ouverture ne sont pas encore définis. <Link href="/app/horaires" className="font-medium underline">Définissez-les</Link> pour que les jours fermés soient bloqués.</p>
          ) : (
            <p className="flex items-start gap-2 text-sm text-muted"><Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Les jours où vous êtes fermé sont bloqués et les heures restent dans vos horaires d&apos;ouverture. <Link href="/app/horaires" className="font-medium text-accent hover:text-accent-hover">Modifier mes horaires</Link></p>
          )}
          <fieldset className="space-y-2" disabled={!picked.size}>
            <legend className="sr-only">Mode</legend>
            {([[false, "Pendant toutes les heures d'ouverture"], [true, "Seulement certains jours ou à certaines heures"]] as const).map(([v, label]) => (
              <label key={String(v)} className="flex items-center gap-3 text-sm">
                <input type="radio" name="mode" checked={limited === v} onChange={() => setLimited(v)} className="size-4 accent-[var(--accent)]" />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
        {limited ? <WeekRanges value={week} onChange={setWeek} disabled={!picked.size} offLabel="Non proposée" defaultRange={{ start: "09:00", end: "12:00" }} bounds={bounds} className="border-t border-border" /> : null}
        <div className="space-y-2 border-t border-border p-5">
          {problem ? <p className="text-sm text-danger" role="alert">{problem}</p> : null}
          {msg ? <p className={cn("text-sm", msg.ok ? "text-success" : "text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
          <Button loading={pending} disabled={!picked.size || !!problem || (limited && empty)} onClick={apply} icon={<CalendarClock className="size-4" aria-hidden="true" />}>
            {picked.size ? `Appliquer à ${picked.size} prestation${picked.size > 1 ? "s" : ""}` : "Appliquer"}
          </Button>
          {limited && empty && picked.size ? <p className="text-xs text-muted">Activez au moins un jour.</p> : null}
        </div>
      </Card>
    </div>
  );
}

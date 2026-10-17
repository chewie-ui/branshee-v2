import { TZDate } from "@date-fns/tz";

/**
 * Séances d'un cours récurrent (« tous les lundis et jeudis à 18:00 »), calculées à la volée.
 * Elles ne sont enregistrées en base qu'à la première inscription (ou si on annule une séance précise).
 */
export type Recurrence = { weekdays: number[]; startTime: string };

/** Identifiant d'une séance calculée : « r_<serviceId>_<timestamp ms> ». */
export const virtualSessionId = (serviceId: string, startsAt: Date) => `r_${serviceId}_${startsAt.getTime()}`;

export function parseVirtualSessionId(id: string): { serviceId: string; startsAt: Date } | null {
  const m = id.match(/^r_([0-9a-f-]{36})_(\d{10,15})$/);
  return m ? { serviceId: m[1]!, startsAt: new Date(Number(m[2])) } : null;
}

/** Occurrences entre deux instants (bornes incluses pour le début de séance). */
export function occurrences(rec: Recurrence, durationMin: number, from: Date, to: Date, timezone: string): { startsAt: Date; endsAt: Date }[] {
  const [h, m] = rec.startTime.split(":").map(Number) as [number, number];
  if (!rec.weekdays.length || Number.isNaN(h)) return [];
  const out: { startsAt: Date; endsAt: Date }[] = [];
  const cursor = new TZDate(from, timezone);
  let day = new TZDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 12, 0, 0, timezone);
  for (let i = 0; i < 800 && day.getTime() <= to.getTime() + 86400000; i++) {
    if (rec.weekdays.includes(day.getDay())) {
      const start = new Date(new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, timezone).getTime());
      if (start >= from && start <= to) out.push({ startsAt: start, endsAt: new Date(start.getTime() + durationMin * 60000) });
    }
    day = new TZDate(day.getFullYear(), day.getMonth(), day.getDate() + 1, 12, 0, 0, timezone);
  }
  return out;
}

/** Vrai si `startsAt` est bien une occurrence du cours (protège la réservation d'identifiants forgés). */
export function isOccurrence(rec: Recurrence, startsAt: Date, timezone: string) {
  const z = new TZDate(startsAt, timezone);
  const hhmm = `${String(z.getHours()).padStart(2, "0")}:${String(z.getMinutes()).padStart(2, "0")}`;
  return rec.weekdays.includes(z.getDay()) && hhmm === rec.startTime && z.getSeconds() === 0;
}

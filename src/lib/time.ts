import { TZDate } from "@date-fns/tz";
import { addDays, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";

/** Toutes les dates affichées sont dans le fuseau de l'établissement. */
export function zoned(date: Date, timezone: string) {
  return new TZDate(date, timezone);
}

export function dayBounds(day: Date, timezone: string) {
  const start = startOfDay(new TZDate(day, timezone));
  return { start: new Date(start), end: new Date(addDays(start, 1)) };
}

export function weekBounds(day: Date, timezone: string) {
  const start = startOfWeek(new TZDate(day, timezone), { weekStartsOn: 1 });
  return { start: new Date(start), end: new Date(addDays(start, 7)) };
}

/** Grille d'un mois : du lundi précédant le 1er au dimanche suivant le dernier jour. */
export function monthGridBounds(day: Date, timezone: string) {
  const z = new TZDate(day, timezone);
  const start = startOfWeek(startOfMonth(z), { weekStartsOn: 1 });
  const end = addDays(endOfWeek(endOfMonth(z), { weekStartsOn: 1 }), 1);
  return { start: new Date(start), end: new Date(startOfDay(end)), monthStart: new Date(startOfMonth(z)) };
}

export function formatTime(date: Date, timezone: string) {
  return format(new TZDate(date, timezone), "HH:mm");
}

export function formatDay(date: Date, timezone: string, pattern = "EEEE d MMMM") {
  return format(new TZDate(date, timezone), pattern, { locale: fr });
}

/** Minutes écoulées depuis minuit, dans le fuseau donné. */
export function minutesOfDay(date: Date, timezone: string) {
  const z = new TZDate(date, timezone);
  return z.getHours() * 60 + z.getMinutes();
}

export function formatPrice(cents: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

export function formatDuration(min: number, max?: number | null) {
  const f = (m: number) => (m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`);
  return max && max > min ? `${f(min)} – ${f(max)}` : f(min);
}

/** Parse "YYYY-MM-DD" (paramètre d'URL) ; renvoie null si invalide. */
export function parseIsoDay(value: string | undefined | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + "T12:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** « 2026-11-02 », « 10:00 » → « lun. 2 nov. à 10:00 » (journal d'activité, e-mails). */
export function humanDateTime(date: string, time: string) {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return `${date} ${time}`;
  return `${new Intl.DateTimeFormat("fr-BE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d)} à ${time}`;
}

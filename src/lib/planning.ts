/** App Planning : calculs de semaines et d'heures (purs, testables). Dates « AAAA-MM-JJ », heures « HH:MM ». */

export const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
export const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (s: string) => new Date(`${s}T12:00:00Z`);
const toStr = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toDate(s).getTime());
export const isTime = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export function addDays(day: string, n: number) {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toStr(d);
}

/** Lundi de la semaine qui contient `day`. */
export function mondayOf(day: string) {
  const d = toDate(day);
  const wd = (d.getUTCDay() + 6) % 7; // 0 = lundi
  return addDays(day, -wd);
}

export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** Numéro de semaine ISO (pour « Semaine 44 »). */
export function isoWeek(day: string) {
  const d = toDate(mondayOf(day));
  const thursday = toDate(addDays(toStr(d), 3));
  const jan4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  return 1 + Math.round((thursday.getTime() - toDate(mondayOf(toStr(jan4))).getTime()) / (7 * 86400000));
}

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Minutes travaillées d'une plage (fin ≤ début = le lendemain), pause déduite. */
export function shiftMinutes(start: string, end: string, breakMinutes = 0) {
  let m = mins(end) - mins(start);
  if (m <= 0) m += 24 * 60;
  return Math.max(0, m - breakMinutes);
}

export const overnight = (start: string, end: string) => mins(end) <= mins(start);

/** « 7 h 30 », « 38 h », « 0 h ». */
export function fmtHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${pad(m)}` : `${h} h`;
}

/** « 26 oct. – 1 nov. 2026 » */
export function weekRangeLabel(monday: string) {
  const f = (d: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", ...opts }).format(toDate(d));
  const sunday = addDays(monday, 6);
  return `${f(monday, { day: "numeric", month: "short" })} – ${f(sunday, { day: "numeric", month: "short", year: "numeric" })}`;
}

export const dayLabel = (day: string) => new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(toDate(day));
export const dayNum = (day: string) => toDate(day).getUTCDate();

/** App Congés : types d'absence, jours fériés belges et décompte en jours ouvrables (purs, testables). */
import { addDays } from "@/lib/planning";

export const LEAVE_KINDS = {
  conge: { label: "Congé", counted: true },
  maladie: { label: "Maladie", counted: false },
  recup: { label: "Récupération", counted: false },
  formation: { label: "Formation", counted: false },
  sans_solde: { label: "Sans solde", counted: false },
  autre: { label: "Autre absence", counted: false },
} as const;
export type LeaveKind = keyof typeof LEAVE_KINDS;
export const isLeaveKind = (k: unknown): k is LeaveKind => typeof k === "string" && k in LEAVE_KINDS;

export const LEAVE_STATUS = {
  pending: { label: "En attente", tone: "warning" },
  approved: { label: "Validé", tone: "success" },
  refused: { label: "Refusé", tone: "danger" },
  cancelled: { label: "Annulé", tone: "neutral" },
} as const;
export type LeaveStatus = keyof typeof LEAVE_STATUS;

export type LeavePeriod = "full" | "am" | "pm";
export const PERIOD_LABEL: Record<LeavePeriod, string> = { full: "Journée entière", am: "Matin", pm: "Après-midi" };

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher). */
function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Les 10 jours fériés légaux en Belgique. */
export function belgianHolidays(year: number): Map<string, string> {
  const e = easter(year);
  return new Map([
    [`${year}-01-01`, "Nouvel An"],
    [addDays(e, 1), "Lundi de Pâques"],
    [`${year}-05-01`, "Fête du Travail"],
    [addDays(e, 39), "Ascension"],
    [addDays(e, 50), "Lundi de Pentecôte"],
    [`${year}-07-21`, "Fête nationale"],
    [`${year}-08-15`, "Assomption"],
    [`${year}-11-01`, "Toussaint"],
    [`${year}-11-11`, "Armistice"],
    [`${year}-12-25`, "Noël"],
  ]);
}

const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = dimanche

export function datesBetween(start: string, end: string) {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Jours ouvrables (lundi à vendredi, hors fériés belges) de la période. */
export function workingDays(start: string, end: string) {
  const cache = new Map<number, Map<string, string>>();
  return datesBetween(start, end).filter((d) => {
    const wd = weekday(d);
    if (wd === 0 || wd === 6) return false;
    const y = Number(d.slice(0, 4));
    if (!cache.has(y)) cache.set(y, belgianHolidays(y));
    return !cache.get(y)!.has(d);
  });
}

/** Demi-journées décomptées pour une demande (une demi-journée = 1, une journée = 2). */
export function leaveHalfDays(start: string, end: string, period: LeavePeriod = "full") {
  const n = workingDays(start, end).length;
  return period !== "full" && start === end ? Math.min(n, 1) : n * 2;
}

/** « 1 jour », « 2,5 jours », « ½ jour ». */
export function fmtDays(halfDays: number) {
  if (halfDays === 1) return "½ jour";
  const d = halfDays / 2;
  return `${String(d).replace(".", ",")} jour${d > 1 ? "s" : ""}`;
}

export const fmtDate = (day: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", ...opts }).format(new Date(`${day}T12:00:00Z`));

/** « du 3 au 7 nov. », « le 12 déc. (matin) » */
export function fmtRange(start: string, end: string, period: LeavePeriod = "full") {
  if (start === end) return `le ${fmtDate(start, { weekday: "short", day: "numeric", month: "short" })}${period !== "full" ? ` (${PERIOD_LABEL[period].toLowerCase()})` : ""}`;
  return `du ${fmtDate(start)} au ${fmtDate(end, { day: "numeric", month: "short", year: start.slice(0, 4) !== end.slice(0, 4) ? "numeric" : undefined })}`;
}

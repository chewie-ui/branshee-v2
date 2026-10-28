/** App Paie (pré-paie) : calculs du mois (pur, testé). Minutes et centimes. */
import { leaveHalfDays, workingDays } from "./leave";

export const monthBounds = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
};
export const isMonth = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 15));
  return d.toISOString().slice(0, 7);
};

/** Demi-journées d'une absence comprises dans le mois (une absence peut déborder sur deux mois). */
export function leaveHalfDaysInMonth(start: string, end: string, period: "full" | "am" | "pm", month: string) {
  const { from, to } = monthBounds(month);
  const s = start < from ? from : start;
  const e = end > to ? to : end;
  if (s > e) return 0;
  return leaveHalfDays(s, e, start === end ? period : "full");
}

/** Heures prévues au contrat sur le mois : (heures / semaine ÷ 5) × jours ouvrables (fériés belges exclus). */
export function contractMinutes(weeklyMinutes: number, month: string) {
  const { from, to } = monthBounds(month);
  return Math.round((weeklyMinutes / 5) * workingDays(from, to).length);
}

/** Brut indicatif : taux horaire × heures, ou salaire mensuel fixe ; plus les primes. */
export function grossEstimate(p: { payType: string; rateCents: number }, minutes: number, bonusCents: number) {
  const base = p.payType === "monthly" ? p.rateCents : Math.round((p.rateCents * minutes) / 60);
  return base + bonusCents;
}

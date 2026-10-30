import { z } from "@/lib/zod";

/** Validation commune des grilles hebdomadaires (horaires d'ouverture, plages d'une prestation). */
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide");
export const range = z.object({ start: time, end: time }).refine((r) => r.start < r.end, "La fin doit être après le début.");
export const dayRanges = z
  .array(range)
  .max(6)
  .refine((list) => {
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
    return sorted.every((r, i) => i === 0 || sorted[i - 1]!.end <= r.start);
  }, "Deux plages se chevauchent.");

export const weekSchema = z.partialRecord(z.enum(["0", "1", "2", "3", "4", "5", "6"]), dayRanges);

export const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Message lisible pour une erreur de validation d'une semaine (« Mardi : Deux plages se chevauchent. »). */
export function weekError(issues: z.core.$ZodIssue[]) {
  const issue = issues[0]!;
  const day = DAY_NAMES[Number(issue.path[0])];
  return day ? `${day.charAt(0).toUpperCase() + day.slice(1)} : ${issue.message}` : issue.message;
}

/** App Projets : statuts, couleurs et durées (pur, testé). */
export const TASK_STATUS = [
  { id: "todo", label: "À faire" },
  { id: "doing", label: "En cours" },
  { id: "review", label: "À valider" },
  { id: "done", label: "Terminé" },
] as const;
export type TaskStatus = (typeof TASK_STATUS)[number]["id"];
export const isTaskStatus = (s: unknown): s is TaskStatus => typeof s === "string" && TASK_STATUS.some((t) => t.id === s);

export const PROJECT_STATUS = { active: "En cours", done: "Terminé", archived: "Archivé" } as const;
export type ProjectStatus = keyof typeof PROJECT_STATUS;

/** Pastilles de couleur des projets (classes Tailwind complètes pour être générées). */
export const PROJECT_COLORS = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  slate: "bg-slate-500",
} as const;
export type ProjectColor = keyof typeof PROJECT_COLORS;
export const COLOR_LABELS: Record<ProjectColor, string> = { indigo: "Indigo", emerald: "Vert", amber: "Ambre", rose: "Rose", sky: "Bleu ciel", violet: "Violet", slate: "Gris" };
export const colorClass = (c: string) => PROJECT_COLORS[c as ProjectColor] ?? PROJECT_COLORS.indigo;

/** 95 → « 1 h 35 », 60 → « 1 h », 20 → « 20 min ». */
export function fmtMinutes(m: number) {
  const h = Math.floor(Math.abs(m) / 60);
  const r = Math.abs(m) % 60;
  const s = h ? `${h} h${r ? ` ${String(r).padStart(2, "0")}` : ""}` : `${r} min`;
  return m < 0 ? `-${s}` : s;
}

/** Durée saisie librement : « 1h30 », « 1:30 », « 1,5 », « 90min », « 45 » (minutes si ≥ 10 sans unité). */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,3})(?:h|:)(\d{1,2})?(?:min|m)?$/))) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  if ((m = s.match(/^(\d{1,4})(?:min|m)$/))) return Number(m[1]);
  if ((m = s.match(/^(\d{1,3})[.,](\d{1,2})h?$/))) return Math.round(Number(`${m[1]}.${m[2]}`) * 60);
  if ((m = s.match(/^(\d{1,4})$/))) return Number(m[1]) < 10 ? Number(m[1]) * 60 : Number(m[1]);
  return null;
}

/** Montant du temps : minutes × tarif horaire (centimes). */
export const timeValue = (minutes: number, hourlyRateCents: number) => Math.round((minutes * hourlyRateCents) / 60);

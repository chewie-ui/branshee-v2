/** App Ventes : étapes du tunnel et calculs (purs, testés). */
export const STAGES = [
  { id: "lead", label: "Nouvelle piste", chance: 10 },
  { id: "contacted", label: "Contacté", chance: 25 },
  { id: "quote", label: "Devis envoyé", chance: 50 },
  { id: "negotiation", label: "Négociation", chance: 75 },
  { id: "won", label: "Gagné", chance: 100 },
  { id: "lost", label: "Perdu", chance: 0 },
] as const;
export type Stage = (typeof STAGES)[number]["id"];
export const OPEN_STAGES = STAGES.filter((s) => s.id !== "won" && s.id !== "lost");
export const isStage = (s: unknown): s is Stage => typeof s === "string" && STAGES.some((x) => x.id === s);
export const stageLabel = (s: string) => STAGES.find((x) => x.id === s)?.label ?? s;
export const isOpen = (s: string) => s !== "won" && s !== "lost";

export const SOURCES = ["Bouche-à-oreille", "Site web", "Réseaux sociaux", "Salon ou événement", "Appel entrant", "Prospection", "Partenaire", "Autre"] as const;
export const ACTIVITY_KINDS = { note: "Note", call: "Appel", email: "Email", meeting: "Rendez-vous", stage: "Étape" } as const;
export type ActivityKind = keyof typeof ACTIVITY_KINDS;

type DealLike = { stage: string; valueCents: number; closedAt?: string | Date | null };

/** Valeur pondérée : montant × probabilité de l'étape. */
export function weighted(deals: DealLike[]) {
  return Math.round(deals.filter((d) => isOpen(d.stage)).reduce((a, d) => a + (d.valueCents * (STAGES.find((s) => s.id === d.stage)?.chance ?? 0)) / 100, 0));
}

/** Taux de réussite sur les pistes clôturées (gagnées / gagnées + perdues), en %. Null s'il n'y en a pas. */
export function winRate(deals: DealLike[]) {
  const won = deals.filter((d) => d.stage === "won").length;
  const lost = deals.filter((d) => d.stage === "lost").length;
  return won + lost ? Math.round((won / (won + lost)) * 100) : null;
}

/** Relance en retard, du jour ou à venir (dates AAAA-MM-JJ comparées comme du texte). */
export function followUpState(date: string | null, today: string): "late" | "today" | "soon" | "none" {
  if (!date) return "none";
  return date < today ? "late" : date === today ? "today" : "soon";
}

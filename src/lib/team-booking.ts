import { slugify } from "@/lib/slug";

/**
 * Réservation avec une équipe : le client choisit son praticien, ou c'est le premier disponible.
 * Chaque praticien a aussi sa propre page : l'adresse de l'entreprise avec « ?avec=<prénom-nom> ».
 */
export const TEAM_CHOICES = {
  choose: { label: "Le client choisit", desc: "Il choisit la personne qu'il veut, ou « sans préférence »." },
  auto: { label: "Premier disponible", desc: "Le client choisit seulement le créneau : le rendez-vous va à la personne libre." },
} as const;
export type TeamChoice = keyof typeof TEAM_CHOICES;
export const teamChoiceOf = (s: string | null | undefined): TeamChoice => (s === "auto" ? "auto" : "choose");

/** Adresse courte d'un praticien (« lea-salle »), unique dans l'équipe (sinon suffixée par le début de son identifiant). */
export function memberSlug(m: { id: string; name: string }, team: { id: string; name: string }[]) {
  const base = slugify(m.name) || "praticien";
  const same = team.filter((x) => (slugify(x.name) || "praticien") === base);
  return same.length > 1 ? `${base}-${m.id.slice(0, 4)}` : base;
}

/** Praticien d'une adresse « ?avec=… » (ou null si inconnu). */
export function memberFromSlug<T extends { id: string; name: string }>(slug: string | null | undefined, team: T[]): T | null {
  if (!slug || !/^[a-z0-9-]{1,90}$/.test(slug)) return null;
  return team.find((m) => memberSlug(m, team) === slug) ?? null;
}

/**
 * Annuaire grand public : métiers et villes reconnus dans la recherche, adresses des pages
 * « métier » et « métier à ville » (référencement Google), et score de complétude de la page d'un pro.
 */
import { METIERS, VILLES } from "./seo-landing";
import { slugify } from "./slug";

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type DirMetier = { slug: string; nom: string; pluriel: string; keywords: string[] };
export type DirVille = { slug: string; nom: string };

const KNOWN: DirMetier[] = METIERS.map((m) => ({ slug: m.slug, nom: m.nom, pluriel: m.pluriel, keywords: [...new Set([m.nom, ...m.motsCles])] }));

/** Mots courants en plus de ceux des pages SEO (féminins, synonymes). */
const EXTRA: Record<string, string[]> = {
  coiffeur: ["coiffeuse", "coiffure", "salon de coiffure"],
  estheticienne: ["esthéticien", "esthétique", "institut de beauté", "beauté"],
  masseur: ["masseuse", "massage", "massothérapeute"],
  "coach-sportif": ["coach", "personal trainer", "fitness"],
  psychologue: ["psy", "psychothérapeute"],
  kine: ["kinésithérapie", "kinesitherapie"],
  osteopathe: ["ostéopathie"],
  podologue: ["pédicure"],
  tatoueur: ["tatouage", "tattoo"],
};
for (const m of KNOWN) m.keywords.push(...(EXTRA[m.slug] ?? []));

export const knownMetiers = () => KNOWN;
export const knownVilles = (): DirVille[] => VILLES.map((v) => ({ slug: v.slug, nom: v.nom }));

/** « coiffeuse », « Kiné », « salon de coiffure » → le métier connu correspondant. */
export function matchMetier(text: string): DirMetier | null {
  const t = norm(text);
  if (!t) return null;
  return KNOWN.find((m) => m.slug === slugify(t) || m.keywords.some((k) => norm(k) === t) || norm(m.pluriel) === t) ?? null;
}

/** Métier depuis l'adresse : connu, ou métier déclaré par un pro inscrit (« plombier »). */
export function metierFromSlug(slug: string, declaredTypes: string[]): DirMetier | null {
  const known = KNOWN.find((m) => m.slug === slug);
  if (known) return known;
  // Un « métier » qui est en fait un nom de ville (saisie erronée) ne crée pas de page.
  if (VILLES.some((v) => v.slug === slug)) return null;
  const types = declaredTypes.filter((t) => slugify(t) === slug);
  if (!types.length) return null;
  const nom = types[0].trim().toLowerCase();
  return { slug, nom, pluriel: nom.endsWith("s") ? nom : `${nom}s`, keywords: [...new Set(types)] };
}

/** Ville depuis l'adresse : liste des pages SEO, ou ville déclarée par un pro inscrit. */
export function villeFromSlug(slug: string, declaredCities: string[]): DirVille | null {
  const v = VILLES.find((x) => x.slug === slug);
  if (v) return { slug, nom: v.nom };
  const c = declaredCities.find((x) => slugify(x) === slug);
  return c ? { slug, nom: c.trim().replace(/\b\p{L}/gu, (l) => l.toUpperCase()) } : null;
}

/**
 * « coiffeur wavre » tapé dans un seul champ : sépare le métier et la ville quand la fin du texte
 * est une ville connue. Renvoie null si rien ne se reconnaît.
 */
export function splitQuery(q: string, cities: DirVille[]): { what: string; where: string } | null {
  const words = norm(q).split(" ").filter(Boolean);
  for (let i = 1; i < words.length; i++) {
    const where = words.slice(i).filter((w, j) => !(j === 0 && (w === "a" || w === "sur" || w === "pres" || w === "de")));
    const city = cities.find((c) => c.slug === slugify(where.join(" ")));
    if (city) return { what: words.slice(0, i).join(" "), where: city.nom };
  }
  return null;
}

export const metierUrl = (m: string) => `/annuaire/${m}`;
export const metierVilleUrl = (m: string, v: string) => `/annuaire/${m}/${v}`;

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ─── Complétude de la page publique ─────────────────────────────────────────

export type PageFacts = { photo: boolean; description: boolean; type: boolean; address: boolean; services: number; hours: boolean; reviews: number };
export type PageItem = { key: keyof PageFacts; label: string; href: string; done: boolean };

/** Ce qui fait qu'une page ressort dans l'annuaire et donne envie de réserver. */
export function pageCompleteness(f: PageFacts) {
  const items: PageItem[] = [
    { key: "type", label: "Votre métier", href: "/app/reglages/etablissement", done: f.type },
    { key: "address", label: "Votre adresse et votre ville", href: "/app/reglages/etablissement", done: f.address },
    { key: "description", label: "Une courte présentation", href: "/app/reglages/etablissement", done: f.description },
    { key: "photo", label: "Une photo ou un logo", href: "/app/reglages/etablissement", done: f.photo },
    { key: "services", label: "Au moins une prestation", href: "/app/prestations", done: f.services > 0 },
    { key: "hours", label: "Vos horaires", href: "/app/horaires", done: f.hours },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, percent: Math.round((done / items.length) * 100), listed: f.type && f.address };
}

/**
 * Codes postaux belges (liste bpost : code + localité) pour les suggestions « Où » de l'annuaire
 * et pour comprendre « 1300 » ou « 1300 Wavre » dans une recherche.
 */
import data from "@/data/be-postcodes.json";
import { norm } from "@/lib/directory";

type Row = [zip: string, city: string];
const ROWS = data as Row[];

/** « Ottignies-Louvain-La-Neuve » → « Ottignies-Louvain-la-Neuve » (articles en minuscules). */
const tidy = (c: string) => c.replace(/-(La|Le|Les|De|Du|Des|Sur|Sous|En|Aux|Au|Lez|Lès)(?=-)/g, (m) => m.toLowerCase());

export type Place = { zip: string; city: string; label: string };

/** Localités qui correspondent à ce qui est tapé : code postal (début) ou nom (début de mot), les villes connues d'abord. */
export function suggestPlaces(q: string, preferred: string[] = [], limit = 8): Place[] {
  const t = q.trim();
  if (!t) return [];
  const pref = new Set(preferred.map(norm));
  let rows: Row[];
  if (/^\d{1,4}$/.test(t)) rows = ROWS.filter((r) => r[0].startsWith(t));
  else {
    const n = norm(t);
    rows = ROWS.filter((r) => {
      const c = norm(r[1]);
      return c.startsWith(n) || c.includes(` ${n}`) || c.includes(`-${n}`);
    });
  }
  const scored = rows.map((r) => ({ r, s: (pref.has(norm(r[1])) ? 0 : 2) + (norm(r[1]).startsWith(norm(t)) ? 0 : 1) }));
  scored.sort((a, b) => a.s - b.s || a.r[1].length - b.r[1].length || a.r[0].localeCompare(b.r[0]));
  return scored.slice(0, limit).map(({ r }) => ({ zip: r[0], city: tidy(r[1]), label: `${r[0]} ${tidy(r[1])}` }));
}

/**
 * Lieu tapé dans la recherche → texte à chercher : « 1300 Wavre » → « Wavre », « 1300 » → « Wavre » (localité principale
 * de ce code, celle dont le nom est le plus connu parmi `preferred`, sinon la première), un nom → inchangé.
 */
export function placeQuery(raw: string, preferred: string[] = []): string {
  const t = raw.trim();
  const withCity = /^(\d{4})\s+(.+)$/.exec(t);
  if (withCity) return withCity[2]!.trim();
  if (/^\d{4}$/.test(t)) {
    const rows = ROWS.filter((r) => r[0] === t);
    if (!rows.length) return t;
    const pref = new Set(preferred.map(norm));
    return tidy((rows.find((r) => pref.has(norm(r[1]))) ?? rows[rows.length - 1]!)[1]);
  }
  return t;
}

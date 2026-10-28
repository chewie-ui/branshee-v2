/** App Fidélité : codes de cartes cadeaux et calculs (pur, testé). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O, 1/I

/** Code lisible au téléphone : « K7RM-PQ2X ». `rand` renvoie des octets aléatoires. */
export function giftCode(rand: (n: number) => Uint8Array) {
  const b = rand(8);
  const chars = [...b].map((x) => ALPHABET[x % ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.{4})$/, "$1-$2");

/** Date + n mois (AAAA-MM-JJ), en restant sur un jour valide (31 janv. + 1 mois → 28/29 févr.). */
export function addMonths(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** Tampons après un passage : la récompense se débloque quand on atteint l'objectif. */
export const stampProgress = (stamps: number, goal: number) => ({ ready: stamps >= goal, left: Math.max(0, goal - stamps) });

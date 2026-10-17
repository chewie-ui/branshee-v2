/**
 * Saisie rapide d'une heure : « 9 » → 09:00, « 930 » / « 0930 » → 09:30, « 9h30 », « 9:30 », « 18 h » → 18:00.
 * Renvoie null si la saisie n'est pas une heure valide.
 */
export function parseQuickTime(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  let h: number, m: number;
  const sep = s.match(/^(\d{1,2})[h:.](\d{0,2})$/);
  if (sep) {
    h = Number(sep[1]);
    m = sep[2] ? Number(sep[2].padEnd(2, "0")) : 0;
  } else if (/^\d{1,4}$/.test(s)) {
    if (s.length <= 2) [h, m] = [Number(s), 0];
    else [h, m] = [Number(s.slice(0, -2)), Number(s.slice(-2))];
  } else return null;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
export const hhmmOf = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

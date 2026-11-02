/**
 * Lit un nombre tapé à la belge ou à l'anglaise : « 12,50 », « 12.50 », « 1.234,56 », « 1 234,56 », « 1.234.567 ».
 * Avec une virgule, les points sont des séparateurs de milliers ; sans virgule, un seul point est la décimale
 * et plusieurs points sont des milliers. Renvoie NaN si le texte n'est pas un nombre.
 */
export function parseDecimal(v: unknown): number {
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[\s  ']/g, "");
  if (!s) return NaN;
  if (s.includes(",")) {
    s = s.replace(/\./g, "");
    if (s.split(",").length > 2) return NaN;
    s = s.replace(",", ".");
  } else if (s.split(".").length > 2) {
    s = s.replace(/\./g, "");
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

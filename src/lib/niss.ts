/**
 * Numéro d'identification de la sécurité sociale belge (NISS / INSZ) : 11 chiffres AAMMJJ-SSS-CC.
 * Clé de contrôle : 97 − (nombre des 9 premiers chiffres mod 97) ; pour les naissances depuis 2000, on préfixe « 2 ».
 * Numéros bis (mois + 20 ou + 40) acceptés.
 */
export function normalizeNiss(input: string | null | undefined): string | null {
  const d = (input ?? "").replace(/\D/g, "");
  return d.length === 11 ? d : null;
}

export function validNiss(input: string | null | undefined): boolean {
  const d = normalizeNiss(input);
  if (!d) return false;
  const base = d.slice(0, 9);
  const check = Number(d.slice(9));
  return 97 - (Number(base) % 97) === check || 97 - (Number("2" + base) % 97) === check;
}

/** « 85073003328 » → « 85.07.30-033.28 » (format lisible usuel). */
export function formatNiss(input: string | null | undefined): string {
  const d = normalizeNiss(input);
  if (!d) return input ?? "";
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 6)}-${d.slice(6, 9)}.${d.slice(9)}`;
}

/** Date de naissance et sexe déduits du NISS quand c'est possible (pas pour les numéros bis inconnus). */
export function nissFacts(input: string | null | undefined): { birthDate: string | null; sex: "M" | "F" | null } {
  const d = normalizeNiss(input);
  if (!d || !validNiss(d)) return { birthDate: null, sex: null };
  const after2000 = 97 - (Number("2" + d.slice(0, 9)) % 97) === Number(d.slice(9));
  let mm = Number(d.slice(2, 4));
  if (mm > 40) mm -= 40;
  else if (mm > 20) mm -= 20;
  const dd = Number(d.slice(4, 6));
  const yy = d.slice(0, 2);
  const birthDate = mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 ? `${after2000 ? "20" : "19"}${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}` : null;
  const seq = Number(d.slice(6, 9));
  return { birthDate, sex: seq % 2 === 1 ? "M" : "F" };
}

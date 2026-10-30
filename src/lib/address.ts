/**
 * « Rue de Namur 10, 1300 Wavre » → rue, code postal, ville (adresse belge saisie d'un bloc).
 * Renvoie null si le code postal à 4 chiffres et la ville ne sont pas reconnus.
 */
export function splitBeAddress(text: string | null | undefined): { street: string; postalCode: string; city: string } | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  const m = t.match(/^(.*?)[,\s]+(?:B-?)?(\d{4})\s+([^,\d][^,]*?)(?:,\s*(?:Belgique|Belgium|België))?$/i);
  if (!m || !m[1]!.trim()) return null;
  return { street: m[1]!.replace(/,\s*$/, "").trim(), postalCode: m[2]!, city: m[3]!.trim() };
}

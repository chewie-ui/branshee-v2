/** Pays proposés pour l'entreprise (codes ISO à 2 lettres). Les noms viennent du navigateur / de Node (Intl). */
export const COUNTRY_CODES = [
  "BE", "FR", "LU", "NL", "DE", "CH", "ES", "IT", "PT", "IE", "AT", "GB", "DK", "SE", "NO", "FI", "PL", "CZ", "SK", "SI", "HR", "HU", "RO", "BG", "GR", "CY", "MT", "EE", "LV", "LT",
  "US", "CA", "MX", "BR", "AR", "CL", "CO", "PE",
  "MA", "DZ", "TN", "SN", "CI", "CM", "CD", "MG", "MU", "ZA", "NG", "KE", "EG",
  "AE", "SA", "QA", "IL", "TR", "IN", "SG", "HK", "JP", "KR", "CN", "TH", "VN", "PH", "ID", "MY", "AU", "NZ",
] as const;

export const isCountryCode = (c: string): boolean => (COUNTRY_CODES as readonly string[]).includes(c);

export function countryName(code: string, locale: "fr" | "en" = "fr"): string {
  try {
    return new Intl.DisplayNames([locale === "en" ? "en" : "fr"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Liste triée par nom, Belgique en tête. */
export function countryOptions(locale: "fr" | "en" = "fr") {
  const coll = new Intl.Collator(locale);
  const rest = COUNTRY_CODES.filter((c) => c !== "BE").map((c) => ({ code: c as string, name: countryName(c, locale) })).sort((a, b) => coll.compare(a.name, b.name));
  return [{ code: "BE", name: countryName("BE", locale) }, ...rest];
}

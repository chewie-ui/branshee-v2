/** Langues proposées pour « Langues parlées » (codes ISO 639-1). */
export const LANGUAGES: { code: string; name: string }[] = [
  { code: "fr", name: "Français" },
  { code: "nl", name: "Néerlandais" },
  { code: "en", name: "Anglais" },
  { code: "de", name: "Allemand" },
  { code: "es", name: "Espagnol" },
  { code: "it", name: "Italien" },
  { code: "pt", name: "Portugais" },
  { code: "ar", name: "Arabe" },
  { code: "tr", name: "Turc" },
  { code: "pl", name: "Polonais" },
  { code: "ro", name: "Roumain" },
  { code: "ru", name: "Russe" },
];

export const LANGUAGE_NAMES: Record<string, string> = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.name]));

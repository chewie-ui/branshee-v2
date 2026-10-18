/** Langues de l'interface publique (comme l'ancien Branshee). */
export const LOCALES = ["fr", "en", "nl", "de", "es", "it"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_NAMES: Record<Locale, string> = { fr: "Français", en: "English", nl: "Nederlands", de: "Deutsch", es: "Español", it: "Italiano" };
/** Code régional pour les dates, nombres et montants. */
export const INTL_LOCALE: Record<Locale, string> = { fr: "fr-BE", en: "en-GB", nl: "nl-BE", de: "de-DE", es: "es-ES", it: "it-IT" };
export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
export const LANG_COOKIE = "bs_lang";

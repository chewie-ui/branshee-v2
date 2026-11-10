import { EN } from "@/lib/i18n/app-en";

/**
 * Langue de l'espace pro (réglage « Langue » du compte). Les textes sont écrits en français dans le code
 * et passent par `t("Texte français")` : la version anglaise vient du dictionnaire `app-en.ts`.
 * Un texte absent du dictionnaire reste en français (jamais de page cassée).
 * Variables : `t("Bonjour {name}", { name })`.
 */
export type AppLocale = "fr" | "en";

export type Vars = Record<string, string | number>;

function fill(s: string, vars?: Vars) {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

export function tr(fr: string, locale: AppLocale, vars?: Vars): string {
  return fill(locale === "en" ? (EN[fr] ?? fr) : fr, vars);
}

export const makeT = (locale: AppLocale) => Object.assign((fr: string | null | undefined, vars?: Vars) => tr(fr ?? "", locale, vars), { locale });

/** Langue des dates et nombres (Intl) pour une langue de l'espace pro. */
export const intlLocale = (locale: AppLocale) => (locale === "en" ? "en-GB" : "fr-BE");
export type T = ReturnType<typeof makeT>;

export const asLocale = (v: string | null | undefined): AppLocale => (v === "en" ? "en" : "fr");

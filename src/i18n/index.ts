import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "@/i18n/config";
import de from "@/i18n/messages/de";
import en from "@/i18n/messages/en";
import es from "@/i18n/messages/es";
import fr, { type Messages } from "@/i18n/messages/fr";
import it from "@/i18n/messages/it";
import nl from "@/i18n/messages/nl";

export type { Messages };
const ALL: Record<Locale, Messages> = { fr, en, nl, de, es, it };

export const getMessages = (locale: Locale): Messages => ALL[locale] ?? ALL[DEFAULT_LOCALE];

/** Clés « a.b.c » des textes (tableaux et objets exclus). */
type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Leaves<T> = { [K in keyof T & string]: T[K] extends string ? K : T[K] extends readonly unknown[] ? never : T[K] extends Record<string, string> ? (string extends keyof T[K] ? never : Join<K, Leaves<T[K]>>) : Join<K, Leaves<T[K]>> }[keyof T & string];
export type MessageKey = Leaves<Omit<Messages, "serverErrors">>;

/** Fonction de traduction : t("booking.chooseService", { n: 3 }). */
export function createT(messages: Messages) {
  return (key: MessageKey, vars?: Record<string, string | number>) => {
    let v: unknown = messages;
    for (const part of key.split(".")) v = (v as Record<string, unknown>)?.[part];
    let s = typeof v === "string" ? v : key;
    if (vars) for (const [k, val] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(val));
    return s;
  };
}
export type T = ReturnType<typeof createT>;

export const intlLocale = (l: Locale) => INTL_LOCALE[l];

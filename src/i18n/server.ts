import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LANG_COOKIE, isLocale, type Locale } from "@/i18n/config";

/**
 * Langue de l'interface publique : paramètre `?lang=`, puis cookie (le nouveau, ou celui de l'ancien Branshee),
 * puis la langue du navigateur ; français par défaut.
 */
export async function resolvePublicLocale(param?: string | null, fallback?: string | null): Promise<Locale> {
  if (isLocale(param)) return param;
  const jar = await cookies();
  const c = jar.get(LANG_COOKIE)?.value ?? jar.get("user_lang")?.value;
  if (isLocale(c)) return c;
  if (isLocale(fallback)) return fallback;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}

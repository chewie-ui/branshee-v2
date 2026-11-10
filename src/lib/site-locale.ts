/**
 * Langue du site public Skydev : français à la racine, anglais sous /en (adresses anglaises pour les pages clés).
 * Pur : utilisable côté serveur et navigateur.
 */
export type SiteLocale = "fr" | "en";
export const SITE_LOCALES: SiteLocale[] = ["fr", "en"];

/** Adresses françaises → anglaises (le reste garde son chemin, préfixé par /en). */
const EN_PATHS: [string, string][] = [
  ["/sur-mesure", "/custom"],
  ["/logiciel", "/software"],
  ["/inscription", "/signup"],
  ["/connexion", "/login"],
  ["/mot-de-passe-oublie", "/forgot-password"],
  ["/bienvenue", "/welcome"],
  ["/verifier-email", "/verify-email"],
];

/** Langue d'une adresse demandée (« /en », « /en/… » → anglais). */
export const localeOfPath = (path: string | null | undefined): SiteLocale => (path === "/en" || path?.startsWith("/en/") || path?.startsWith("/en?") || path?.startsWith("/en#") ? "en" : "fr");

/**
 * Lien vers une page du site dans une langue : `localize("/sur-mesure", "en")` → « /en/custom ».
 * Les liens vers l'espace pro (/app…), l'API ou des pages sans version anglaise restent tels quels.
 */
export function localize(href: string, locale: SiteLocale): string {
  if (locale === "fr" || !href.startsWith("/") || href.startsWith("/en")) return href;
  if (/^\/(app|admin|api|demo|media|pro|espace-client|annuaire|blog|developpeurs|logiciel-rendez-vous|vehicules|boutique|formulaire)(\/|$|\?|#)/.test(href)) return href;
  const m = /^([^?#]*)(.*)$/.exec(href)!;
  let path = m[1]!;
  const rest = m[2] ?? "";
  for (const [fr, en] of EN_PATHS) if (path === fr || path.startsWith(`${fr}/`)) { path = en + path.slice(fr.length); break; }
  return path === "/" ? `/en${rest}` : `/en${path}${rest}`;
}

/** Même page dans l'autre langue (pour le bouton FR / EN et les balises hreflang). */
export function unlocalize(path: string): string {
  if (!path.startsWith("/en")) return path;
  let p = path.slice(3) || "/";
  for (const [fr, en] of EN_PATHS) if (p === en || p.startsWith(`${en}/`)) { p = fr + p.slice(en.length); break; }
  return p;
}

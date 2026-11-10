import { metierHrefL, storeHrefL, storeAppBySlugAny, metierBySlugAny } from "@/lib/app-store-i18n";
import { customServiceBySlugAny, customServiceL } from "@/lib/custom-services-i18n";
import { localize, unlocalize, type SiteLocale } from "@/lib/site-locale";

/**
 * Même page dans une langue, slugs traduits compris :
 * « /apps/rendez-vous » ↔ « /en/apps/online-booking », « /sur-mesure/creation-site-internet » ↔ « /en/custom/website-design ».
 */
export function alternatePath(path: string, locale: SiteLocale): string {
  const m = /^([^?#]*)(.*)$/.exec(path)!;
  const fr = unlocalize(m[1]!);
  const rest = m[2] ?? "";
  let seg = fr.split("/").filter(Boolean);
  if (seg[0] === "apps" && seg[1]) {
    const s = storeAppBySlugAny(seg[1]);
    if (s) return storeHrefL(s.id, locale) + rest;
  }
  if (seg[0] === "logiciel" && seg[1]) {
    const x = metierBySlugAny(seg[1]);
    if (x) return metierHrefL(x, locale) + rest;
  }
  if (seg[0] === "sur-mesure" && seg[1]) {
    const s = customServiceBySlugAny(seg[1]);
    if (s) {
      // Les pages par ville n'existent qu'en français.
      if (locale === "en") seg = ["sur-mesure", customServiceL(s, "en").slug];
      else seg = ["sur-mesure", s.slug, ...seg.slice(2)];
      const p = `/${seg.join("/")}`;
      return (locale === "en" ? localize("/sur-mesure", "en") + "/" + seg[1] : p) + rest;
    }
  }
  return localize(fr + rest, locale);
}


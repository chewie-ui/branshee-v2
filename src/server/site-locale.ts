import "server-only";
import { headers } from "next/headers";
import { localeOfPath, localize, type SiteLocale } from "@/lib/site-locale";

/** Langue de la page du site public en cours (d'après l'adresse demandée, transmise par le proxy). */
export async function siteLocale(): Promise<SiteLocale> {
  return localeOfPath((await headers()).get("x-pathname"));
}

/** Fonction de lien dans la langue de la page : `const L = await siteLinker(); L("/apps")`. */
export async function siteLinker() {
  const locale = await siteLocale();
  return (href: string) => localize(href, locale);
}

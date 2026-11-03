import "server-only";
import { headers } from "next/headers";
import { BRANDS, brandForHost, pagePath, visitedHost, type BrandId } from "@/lib/brand";

/** Marque de la requête en cours, déduite de l'adresse visitée. */
export async function currentBrand() {
  return BRANDS[brandForHost(visitedHost(await headers()))];
}

/**
 * Marque d'un établissement, pour tout ce qui touche aux prix et aux droits. L'adresse visitée (en-têtes
 * modifiables par le client) ne sert qu'à l'affichage.
 */
export function businessBrand(business: { brand?: string | null }): BrandId {
  if (business.brand === "skydev" || business.brand === "branshee") return business.brand;
  const forced = process.env.FORCE_BRAND;
  return forced === "skydev" ? "skydev" : "branshee";
}

/** Adresse de la page publique d'une entreprise sur l'adresse visitée (Skydev : /pro/<adresse>). */
export async function publicPagePath(slug: string) {
  return pagePath(slug, (await currentBrand()).id);
}

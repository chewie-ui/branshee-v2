import "server-only";
import { headers } from "next/headers";
import { BRANDS, brandForHost, visitedHost } from "@/lib/brand";

/** Marque de la requête en cours, déduite de l'adresse visitée. */
export async function currentBrand() {
  return BRANDS[brandForHost(visitedHost(await headers()))];
}

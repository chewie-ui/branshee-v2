/**
 * Une plateforme, deux marques : « Skydev » (toutes les apps) et « Branshee » (l'app RDV vendue seule aux kinés).
 * Même code, même base : seule l'adresse visitée change le nom, le logo et l'accueil de l'espace pro.
 */
export type BrandId = "branshee" | "skydev";

export const BRANDS: Record<BrandId, { id: BrandId; name: string; initial: string }> = {
  branshee: { id: "branshee", name: "Branshee", initial: "B" },
  skydev: { id: "skydev", name: "Skydev", initial: "S" },
};

/** Adresses de la plateforme Skydev : skydev.be (site + connexion), client.skydev.be (espace), skydev.localhost (tests). Complétable par `SKYDEV_HOSTS` (liste séparée par des virgules). */
export function skydevHosts(): string[] {
  const extra = (process.env.SKYDEV_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  return ["skydev.be", "client.skydev.be", "skydev.localhost", ...extra];
}

export function bareHost(rawHost: string | null | undefined) {
  return (rawHost ?? "").split(":")[0]!.toLowerCase().replace(/^www\./, "");
}

export function brandForHost(rawHost: string | null | undefined): BrandId {
  const forced = process.env.FORCE_BRAND;
  if (forced === "skydev" || forced === "branshee") return forced;
  return skydevHosts().includes(bareHost(rawHost)) ? "skydev" : "branshee";
}

/**
 * Adresse visitée. Next rend la page de destination d'une redirection de server action avec `host`
 * réécrit en adresse interne ; `x-forwarded-host` (renseigné par Next à partir du Host reçu) garde l'adresse réelle.
 * Usage purement cosmétique (nom, logo) : jamais pour une décision de sécurité.
 */
export function visitedHost(h: { get(name: string): string | null }) {
  return h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host");
}

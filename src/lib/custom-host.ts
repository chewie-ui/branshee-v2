/** Domaine personnalisé (« Mon site ») : tout hôte qui n'est ni celui de l'app, ni localhost, ni une adresse IP. */
export function customHostOf(rawHost: string | null | undefined): string | null {
  const host = (rawHost ?? "").split(":")[0]!.toLowerCase();
  const bare = host.replace(/^www\./, "");
  let app = "branshee.com";
  try {
    app = new URL(process.env.APP_URL ?? "https://branshee.com").hostname.replace(/^www\./, "");
  } catch {
    /* valeur par défaut */
  }
  if (!bare || bare === app || bare === "localhost" || bare.endsWith(".localhost") || /^[\d.]+$/.test(bare) || bare.includes("[")) return null;
  return host;
}

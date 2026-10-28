/** App Avis Google : lien vers le formulaire d'avis de la fiche Google (pur, testé). */
const HOSTS = ["g.page", "maps.app.goo.gl", "goo.gl", "search.google.com", "www.google.com", "google.com", "www.google.be", "google.be", "maps.google.com", "business.google.com"];

/**
 * Accepte le lien « Demander des avis » de Google Business Profile (g.page/r/…/review), un lien Maps,
 * ou directement l'identifiant de lieu (Place ID « ChIJ… »). Renvoie un lien https propre, ou null.
 */
export function normalizeGoogleUrl(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^ChIJ[\w-]{10,200}$/.test(s)) return `https://search.google.com/local/writereview?placeid=${s}`;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!HOSTS.includes(u.hostname.toLowerCase())) return null;
  u.protocol = "https:";
  return u.toString();
}

export const DEFAULT_MESSAGE = "Merci pour votre visite ! Votre avis nous aide beaucoup : il ne prend qu'une minute.";

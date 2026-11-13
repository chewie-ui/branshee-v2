/**
 * Deux espaces, deux adresses : pro.skydev.be ouvre l'espace des pros (toutes les apps, le panel),
 * client.skydev.be l'espace client des particuliers (leurs rendez-vous, leurs cartes de fidélité…).
 * L'adresse reste affichée ; la connexion est partagée entre les sous-domaines de skydev.be.
 */
export const APP_SUBDOMAINS: Record<string, string> = {
  pro: "/app",
  client: "/espace-client",
};

/** Raccourcis courts sur pro.skydev.be (ex. pro.skydev.be/qr = écran du QR fidélité, à mettre sur l'écran d'accueil). */
export const PRO_SHORTCUTS: Record<string, string> = {
  "/qr": "/app/fidelite/qr",
};

/** Noms des apps : réservés (un pro ne peut pas prendre « calendar.skydev.be » comme adresse). */
const APP_WORDS = ["calendar", "booking", "clients", "website", "invoices", "team", "shop", "vehicles", "phone", "custom", "schedule", "leave", "orders", "payroll", "sales", "projects", "jobs", "stock", "pos", "expenses", "accounting", "marketing", "reviews", "loyalty", "sign", "documents", "tasks", "messages", "qr"];

/** « pro.skydev.be » → « /app », « client.skydev.be » → « /espace-client » ; sinon null. */
export function appPathForHost(host: string): string | null {
  const m = /^([a-z-]+)\.skydev\.(?:be|localhost)(?::\d+)?$/.exec(host.toLowerCase());
  return m ? (APP_SUBDOMAINS[m[1]!] ?? null) : null;
}

/** Adresse directe d'une app (pour l'afficher), ou null si elle n'en a pas. */
export function subdomainForAppPath(path: string): string | null {
  const hit = Object.entries(APP_SUBDOMAINS).find(([, p]) => p === path);
  return hit ? `${hit[0]}.skydev.be` : null;
}

/** Sous-domaines qui ne sont jamais la page d'un pro (infrastructure, sites hébergés ailleurs). */
const INFRA = new Set(["www", "client", "budget", "api", "admin", "app", "mail", "smtp", "imap", "pop", "ftp", "webmail", "autodiscover", "status", "docs", "blog", "help", "aide", "support", "demo", "static", "cdn", "assets", "preview", "test", "staging", "dev", "ns1", "ns2", "en", "fr", "nl", "pro", "mnemo", "pizzamamma", "autoconfig"]);

/** Tous les noms réservés (infrastructure + apps), pour la réécriture de next.config. */
export const reservedSubdomains = () => [...INFRA, ...APP_WORDS, ...Object.keys(APP_SUBDOMAINS)];

/** Nom réservé : ni une app, ni l'infrastructure (un pro ne peut pas le choisir comme adresse). */
export const isReservedSubdomain = (name: string) => INFRA.has(name) || APP_WORDS.includes(name) || name in APP_SUBDOMAINS;

/** « mon-cabinet.skydev.be » → « mon-cabinet » (page d'un pro) ; sinon null. */
export function proSlugForHost(host: string): string | null {
  const m = /^([a-z0-9][a-z0-9-]{1,79})\.skydev\.(?:be|localhost)(?::\d+)?$/.exec(host.toLowerCase());
  if (!m || isReservedSubdomain(m[1]!)) return null;
  return m[1]!;
}

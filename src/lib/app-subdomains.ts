/**
 * Adresse directe de chaque app : calendar.skydev.be ouvre l'app RDV, invoices.skydev.be l'app Factures…
 * (noms en anglais, compris en français comme en anglais). Le visiteur arrive dans son espace,
 * directement dans l'app, et garde accès à toutes les autres apps.
 */
export const APP_SUBDOMAINS: Record<string, string> = {
  calendar: "/app/rdv",
  booking: "/app/rdv",
  clients: "/app/clients",
  website: "/app/site",
  invoices: "/app/factures",
  team: "/app/equipe",
  shop: "/app/boutique",
  vehicles: "/app/vehicules",
  phone: "/app/tel-ia",
  custom: "/app/sur-mesure",
  schedule: "/app/planning",
  leave: "/app/conges",
  orders: "/app/commandes",
  payroll: "/app/paie",
  sales: "/app/ventes",
  projects: "/app/projets",
  jobs: "/app/interventions",
  stock: "/app/stock",
  pos: "/app/caisse",
  expenses: "/app/depenses",
  accounting: "/app/compta",
  marketing: "/app/marketing",
  reviews: "/app/avis",
  loyalty: "/app/fidelite",
  sign: "/app/signatures",
  documents: "/app/documents",
  tasks: "/app/taches/aujourdhui",
  messages: "/app/messagerie",
};

/** « calendar.skydev.be » → « /app/rdv » ; sinon null (skydev.be, www, sites des clients…). */
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
export const reservedSubdomains = () => [...INFRA, ...Object.keys(APP_SUBDOMAINS)];

/** Nom réservé : ni une app, ni l'infrastructure (un pro ne peut pas le choisir comme adresse). */
export const isReservedSubdomain = (name: string) => INFRA.has(name) || name in APP_SUBDOMAINS;

/** « mon-cabinet.skydev.be » → « mon-cabinet » (page d'un pro) ; sinon null. */
export function proSlugForHost(host: string): string | null {
  const m = /^([a-z0-9][a-z0-9-]{1,79})\.skydev\.(?:be|localhost)(?::\d+)?$/.exec(host.toLowerCase());
  if (!m || isReservedSubdomain(m[1]!)) return null;
  return m[1]!;
}

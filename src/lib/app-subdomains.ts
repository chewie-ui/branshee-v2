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

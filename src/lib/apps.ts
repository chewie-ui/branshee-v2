import type { NavItem } from "@/lib/navigation";

/**
 * Catalogue des apps de la plateforme Skydev. Ajouter une app = une entrée ici + ses pages sous /app.
 * Sur Skydev, l'accueil affiche toutes les apps ; dans une app, seuls ses menus (`nav`) sont visibles.
 *
 * - `included` : comprise dans l'abonnement unique (Solo / Équipe).
 * - `addon`    : option payante en plus de l'abonnement (coûts à l'usage : minutes de téléphone…).
 * - `quote`    : sur devis (sites et apps sur mesure).
 * - `system`   : app de la plateforme (Réglages), sans prix.
 */
export type AppId = "rdv" | "clients" | "site" | "factures" | "employes" | "boutique" | "tel-ia" | "sur-mesure" | "reglages";

export type AppIcon = "calendar" | "globe" | "file" | "users" | "bag" | "phone" | "wand" | "contacts" | "settings";

export type AppNavItem = NavItem & { soon?: boolean };

export type SkyApp = {
  id: AppId;
  name: string;
  tagline: string;
  icon: AppIcon;
  /** Page d'entrée de l'app dans l'espace pro. */
  href: string;
  status: "active" | "soon";
  billing: "included" | "addon" | "quote" | "system";
  features: string[];
  /** Menus de l'app (onglets en haut de l'écran). */
  nav: AppNavItem[];
  /** Débuts d'adresse qui appartiennent à l'app (en plus de ceux de `nav`). */
  match?: string[];
};

export const APPS: SkyApp[] = [
  {
    id: "rdv",
    name: "RDV",
    tagline: "Vos clients réservent en ligne, 24 h/24.",
    icon: "calendar",
    href: "/app/rdv",
    status: "active",
    billing: "included",
    features: ["Agenda et page de réservation", "Rappels automatiques", "Carte en garantie et acomptes", "Fichier clients"],
    nav: [
      { href: "/app/rdv", label: "Aujourd'hui", icon: "today" },
      { href: "/app/demandes", label: "Demandes", icon: "inbox", permission: "appointments.manage" },
      { href: "/app/agenda", label: "Agenda", icon: "calendar", permission: "appointments.view" },
      { href: "/app/historique", label: "Historique", icon: "history", permission: "appointments.view" },
      { href: "/app/prestations", label: "Prestations", icon: "scissors", permission: "services.view" },
      { href: "/app/horaires", label: "Horaires", icon: "clock" },
      { href: "/app/page-de-reservation", label: "Page de réservation", icon: "globe", permission: "customization.manage" },
    ],
  },
  {
    id: "clients",
    name: "Clients",
    tagline: "Votre fichier clients, partagé par toutes les apps.",
    icon: "contacts",
    href: "/app/clients",
    status: "active",
    billing: "included",
    features: ["Fiches clients et historique", "Notes et documents", "Import et export", "Partagé entre RDV, Factures et Boutique"],
    nav: [{ href: "/app/clients", label: "Clients", icon: "users", permission: "customers.view" }],
  },
  {
    id: "site",
    name: "Site web",
    tagline: "Votre site, relié à vos rendez-vous.",
    icon: "globe",
    href: "/app/site",
    status: "active",
    billing: "included",
    features: ["Site généré à partir de vos infos", "Votre nom de domaine (option)", "Bouton de réservation intégré", "Optimisé pour Google"],
    nav: [{ href: "/app/site", label: "Site web", icon: "layout", permission: "customization.manage" }],
  },
  {
    id: "factures",
    name: "Factures",
    tagline: "Devis et factures conformes en quelques clics.",
    icon: "file",
    href: "/app/factures",
    status: "soon",
    billing: "included",
    features: ["Devis et factures avec mentions légales belges", "Numérotation automatique", "Envoi en PDF au client", "Suivi des paiements"],
    nav: [{ href: "/app/factures", label: "Factures", icon: "file" }],
  },
  {
    id: "employes",
    name: "Employés",
    tagline: "Votre équipe, ses accès et bientôt son planning.",
    icon: "users",
    href: "/app/equipe",
    status: "active",
    billing: "included",
    features: ["Collaborateurs, invitations et accès", "Planning de la semaine (bientôt)", "Demandes de congés (bientôt)", "Lié à l'agenda RDV"],
    nav: [
      { href: "/app/equipe", label: "Équipe", icon: "team", permission: "team.view" },
      { href: "/app/employes", label: "Planning", icon: "calendar", soon: true },
    ],
  },
  {
    id: "boutique",
    name: "Boutique",
    tagline: "Vendez vos produits en ligne.",
    icon: "bag",
    href: "/app/boutique",
    status: "soon",
    billing: "included",
    features: ["Catalogue de produits", "Paiement Bancontact et carte", "Suivi des commandes", "Intégrée à votre site"],
    nav: [{ href: "/app/boutique", label: "Boutique", icon: "bag" }],
  },
  {
    id: "tel-ia",
    name: "Tél IA",
    tagline: "Une IA répond quand vous ne pouvez pas décrocher.",
    icon: "phone",
    href: "/app/tel-ia",
    status: "active",
    billing: "addon",
    features: ["Répond à vos appels manqués", "Résumé de chaque appel par email", "Vous gardez votre numéro", "Forfait de minutes inclus, puis à l'usage"],
    nav: [{ href: "/app/tel-ia", label: "Tél IA", icon: "phone" }],
  },
  {
    id: "sur-mesure",
    name: "Sur mesure",
    tagline: "Tout ce dont vous avez besoin, construit pour vous.",
    icon: "wand",
    href: "/app/sur-mesure",
    status: "active",
    billing: "quote",
    features: ["Sites et boutiques sur mesure", "Apps web et mobiles, logiciels métier, CRM", "Automatisations et outils avec de l'IA", "Maquette, puis prix fixe annoncé à l'avance"],
    nav: [{ href: "/app/sur-mesure", label: "Sur mesure", icon: "wand" }],
  },
  {
    id: "reglages",
    name: "Réglages",
    tagline: "Établissement, abonnement, compte et aide.",
    icon: "settings",
    href: "/app/reglages",
    status: "active",
    billing: "system",
    features: [],
    nav: [
      { href: "/app/reglages", label: "Réglages", icon: "settings", permission: "settings.manage" },
      { href: "/app/reglages/abonnement", label: "Abonnement", icon: "card", permission: "billing.manage" },
      { href: "/app/compte", label: "Mon compte", icon: "users" },
      { href: "/app/aide", label: "Aide et support", icon: "help" },
    ],
    match: ["/app/etablissements", "/app/apps", "/app/modules"],
  },
];

export const appById = (id: AppId) => APPS.find((a) => a.id === id)!;

export const BILLING_LABEL: Record<SkyApp["billing"], string> = {
  included: "Inclus",
  addon: "Option",
  quote: "Sur devis",
  system: "",
};

const starts = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + "/");

/** App de la page affichée : celle dont un début d'adresse correspond le plus longuement. */
export function appForPath<T extends Pick<SkyApp, "nav" | "match">>(apps: T[], path: string): T | null {
  let best: T | null = null;
  let len = 0;
  for (const app of apps)
    for (const prefix of [...app.nav.map((n) => n.href), ...(app.match ?? [])])
      if (starts(path, prefix) && prefix.length > len) {
        best = app;
        len = prefix.length;
      }
  return best;
}

/** Menu actif dans une app : le plus long début d'adresse qui correspond. */
export function activeNavHref(nav: { href: string }[], path: string) {
  return nav.filter((n) => starts(path, n.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

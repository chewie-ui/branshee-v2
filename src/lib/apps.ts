import type { NavItem } from "@/lib/navigation";

/**
 * Catalogue des apps de la plateforme Skydev. Ajouter une app = une entrée ici + ses pages sous /app.
 * Sur Skydev, l'accueil affiche toutes les apps ; dans une app, seuls ses menus (`nav`) sont visibles.
 *
 * - `included` : comprise dans l'abonnement unique Skydev (prix par utilisateur).
 * - `addon`    : option payante en plus de l'abonnement (coûts à l'usage : minutes de téléphone…).
 * - `quote`    : sur devis (sites et apps sur mesure).
 * - `system`   : app de la plateforme (Réglages), sans prix.
 */
export type AppId =
  | "rdv" | "clients" | "site" | "factures" | "employes" | "boutique" | "tel-ia" | "sur-mesure" | "reglages"
  // Apps à venir (page « bientôt » commune : /app/bientot/<id>)
  | "horaires" | "conges" | "commandes" | "paie" | "ventes" | "projets" | "interventions" | "stock" | "caisse" | "depenses" | "compta"
  | "marketing" | "avis" | "fidelite" | "signature" | "documents" | "messagerie";

export type AppIcon = NavItem["icon"];

/** Rangement des apps sur l'accueil et dans « Ajouter des apps ». */
export type AppCategory = "clients" | "finance" | "equipe" | "operations" | "marketing" | "services" | "systeme";
export const CATEGORY_LABEL: Record<AppCategory, string> = {
  clients: "Clients et ventes",
  finance: "Finances",
  equipe: "Équipe",
  operations: "Opérations",
  marketing: "Marketing",
  services: "Services",
  systeme: "Réglages",
};

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
  category: AppCategory;
  features: string[];
  /** Menus de l'app (onglets en haut de l'écran). */
  nav: AppNavItem[];
  /** Débuts d'adresse qui appartiennent à l'app (en plus de ceux de `nav`). */
  match?: string[];
};

const soon = (id: AppId, category: AppCategory, name: string, icon: AppIcon, tagline: string, features: string[]): SkyApp => ({
  id,
  category,
  name,
  tagline,
  icon,
  href: `/app/bientot/${id}`,
  status: "soon",
  billing: "included",
  features,
  nav: [{ href: `/app/bientot/${id}`, label: name, icon }],
});

/** Apps prévues : visibles dans le catalogue avec le badge « Bientôt ». */
const UPCOMING: SkyApp[] = [
  {
    id: "horaires",
    category: "equipe",
    name: "Planning",
    tagline: "Les horaires de votre équipe, semaine par semaine.",
    icon: "planning",
    href: "/app/planning",
    status: "active",
    billing: "included",
    features: ["Planning de la semaine, par personne ou jour par jour", "Plusieurs personnes et plusieurs jours d'un coup", "Export Excel et impression (PDF)", "Dans Google Agenda, Apple ou Outlook"],
    nav: [{ href: "/app/planning", label: "Semaine", icon: "planning" }],
  },
  {
    id: "conges",
    category: "equipe",
    name: "Congés",
    tagline: "Demandes, validation et soldes de congés.",
    icon: "plane",
    href: "/app/conges",
    status: "active",
    billing: "included",
    features: ["Demande en ligne, validation en un clic", "Soldes par personne, jours ouvrables et fériés belges", "Calendrier des absences de l'équipe", "Jours fermés dans l'agenda RDV et visibles dans le Planning"],
    nav: [
      { href: "/app/conges", label: "Congés", icon: "plane" },
      { href: "/app/conges/calendrier", label: "Calendrier", icon: "calendar" },
      { href: "/app/conges/soldes", label: "Soldes", icon: "chart", permission: "availability.manageOthersTimeOff" },
    ],
  },
  {
    id: "commandes",
    category: "clients",
    name: "Commande à table",
    tagline: "Vos clients commandent en scannant un QR code.",
    icon: "qr",
    href: "/app/commandes",
    status: "active",
    billing: "included",
    features: ["Un QR code par table, à imprimer", "Carte en ligne avec photos et allergènes", "Commandes reçues en cuisine en direct", "Le client suit sa commande sur son téléphone"],
    nav: [
      { href: "/app/commandes", label: "En direct", icon: "qr" },
      { href: "/app/commandes/carte", label: "Carte", icon: "receipt" },
      { href: "/app/commandes/tables", label: "Tables", icon: "boxes" },
    ],
  },
  soon("paie", "equipe", "Paie", "wallet", "Salaires et fiches de paie, sans tableur.", ["Salaires, primes et heures prestées", "Fiches de paie en PDF pour chaque employé", "Export vers votre secrétariat social", "Coût total par employé et par mois"]),
  {
    id: "ventes",
    category: "clients",
    name: "Ventes",
    tagline: "Suivez vos prospects jusqu'à la signature.",
    icon: "target",
    href: "/app/ventes",
    status: "active",
    billing: "included",
    features: ["Pistes en colonnes, à glisser d'une étape à l'autre", "Relances du jour : plus aucun oubli", "Devis en un clic depuis la piste (app Factures)", "Prévision du chiffre d'affaires et taux de réussite"],
    nav: [
      { href: "/app/ventes", label: "Pistes", icon: "target", permission: "customers.view" },
      { href: "/app/ventes/relances", label: "Relances", icon: "calendar", permission: "customers.view" },
      { href: "/app/ventes/resultats", label: "Résultats", icon: "chart", permission: "customers.view" },
    ],
  },
  {
    id: "projets",
    category: "operations",
    name: "Projets",
    tagline: "Projets, chantiers et tâches de l'équipe.",
    icon: "kanban",
    href: "/app/projets",
    status: "active",
    billing: "included",
    features: ["Tâches en colonnes, à glisser", "Échéances et responsables", "Temps passé : chrono ou saisie rapide", "Facturation du temps en un clic"],
    nav: [
      { href: "/app/projets", label: "Projets", icon: "kanban" },
      { href: "/app/projets/mes-taches", label: "Mes tâches", icon: "today" },
      { href: "/app/projets/temps", label: "Mon temps", icon: "timer" },
    ],
  },
  soon("interventions", "operations", "Interventions", "truck", "Vos techniciens sur le terrain.", ["Planning des interventions", "Bon d'intervention signé sur téléphone", "Photos avant et après", "Facture créée automatiquement"]),
  soon("stock", "operations", "Stock", "boxes", "Vos produits et vos quantités, à jour.", ["Inventaire et alertes de stock bas", "Entrées, sorties et fournisseurs", "Code-barres avec le téléphone", "Lié à Boutique et Caisse"]),
  soon("caisse", "clients", "Caisse", "store", "Encaissez au comptoir, carte ou cash.", ["Caisse sur tablette ou ordinateur", "Paiement par carte et Bancontact", "Tickets et clôture de caisse", "Stock mis à jour à chaque vente"]),
  {
    id: "depenses",
    category: "finance",
    name: "Dépenses",
    tagline: "Vos tickets et factures d'achat, rangés.",
    icon: "receipt",
    href: "/app/depenses",
    status: "active",
    billing: "included",
    features: ["Photo du ticket ou PDF, chiffré sur nos serveurs", "TVA récupérable calculée (21, 12, 6 %)", "Répartition par catégorie", "Export pour le comptable"],
    nav: [{ href: "/app/depenses", label: "Dépenses", icon: "receipt", permission: "invoices.view" }],
  },
  soon("compta", "finance", "Comptabilité", "calculator", "Préparez la TVA et le bilan sans stress.", ["Recettes et dépenses au même endroit", "Aide à la déclaration TVA", "Export pour votre comptable", "Tableau de trésorerie"]),
  soon("marketing", "marketing", "Marketing", "megaphone", "Emails et SMS à vos clients.", ["Newsletters et campagnes SMS", "Relance des clients inactifs", "Modèles prêts à l'emploi", "Statistiques d'ouverture"]),
  {
    id: "avis",
    category: "marketing",
    name: "Avis Google",
    tagline: "Plus d'avis, une meilleure note.",
    icon: "star",
    href: "/app/avis",
    status: "active",
    billing: "included",
    features: ["Demande d'avis automatique après chaque rendez-vous", "QR code à afficher au comptoir", "Remarques privées : vos clients peuvent aussi vous écrire directement", "Suivi des demandes et des clics vers Google"],
    nav: [
      { href: "/app/avis", label: "Avis", icon: "star" },
      { href: "/app/avis/remarques", label: "Remarques", icon: "message", permission: "customers.view" },
      { href: "/app/avis/reglages", label: "Réglages", icon: "settings", permission: "settings.manage" },
    ],
  },
  soon("fidelite", "marketing", "Fidélité", "gift", "Cartes cadeaux et points fidélité.", ["Cartes cadeaux vendues en ligne", "Points à chaque visite ou achat", "Offres d'anniversaire automatiques", "Lié à RDV, Boutique et Caisse"]),
  soon("signature", "services", "Signature", "signature", "Faites signer devis et contrats en ligne.", ["Signature électronique valable en Belgique", "Devis signé, facture prête", "Rappels aux signataires", "Documents archivés"]),
  soon("documents", "services", "Documents", "folder", "Tous vos fichiers, partagés avec l'équipe.", ["Dossiers par client ou par projet", "Partage sécurisé avec vos clients", "Recherche dans les documents", "Lié aux fiches clients"]),
  soon("messagerie", "equipe", "Messagerie", "message", "Discutez avec votre équipe, sans WhatsApp.", ["Discussions d'équipe et privées", "Fichiers et photos", "Notifications sur téléphone", "Lié aux rendez-vous et projets"]),
];

export const APPS: SkyApp[] = [
  {
    id: "rdv",
    category: "clients",
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
    category: "clients",
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
    category: "marketing",
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
    category: "finance",
    name: "Factures",
    tagline: "Devis et factures conformes en quelques clics.",
    icon: "file",
    href: "/app/factures",
    status: "active",
    billing: "included",
    features: ["Devis et factures avec mentions légales belges", "Numérotation automatique", "PDF et QR de paiement", "Suivi des paiements et relances"],
    nav: [
      { href: "/app/factures", label: "Tableau de bord", icon: "chart", permission: "invoices.view" },
      { href: "/app/factures/liste", label: "Factures", icon: "file", permission: "invoices.view" },
      { href: "/app/factures/devis", label: "Devis", icon: "quote", permission: "invoices.view" },
      { href: "/app/factures/catalogue", label: "Catalogue", icon: "package", permission: "invoices.view" },
      { href: "/app/factures/reglages", label: "Paramètres", icon: "settings", permission: "invoices.view" },
    ],
  },
  {
    id: "employes",
    category: "equipe",
    name: "Employés",
    tagline: "Votre équipe, ses accès et ses grades.",
    icon: "users",
    href: "/app/equipe",
    status: "active",
    billing: "included",
    features: ["Collaborateurs, invitations et accès", "Grades et permissions", "Fiches employés et contrats (bientôt)", "Lié aux apps Planning, Congés et Paie"],
    nav: [{ href: "/app/equipe", label: "Équipe", icon: "team", permission: "team.view" }],
  },
  {
    id: "boutique",
    category: "clients",
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
    category: "services",
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
    category: "services",
    name: "Sur mesure",
    tagline: "Tout ce dont vous avez besoin, construit pour vous.",
    icon: "wand",
    href: "/app/sur-mesure",
    status: "active",
    billing: "quote",
    features: ["Sites et boutiques sur mesure", "Apps web et mobiles, logiciels métier, CRM", "Automatisations et outils avec de l'IA", "Maquette, puis prix fixe annoncé à l'avance"],
    nav: [{ href: "/app/sur-mesure", label: "Sur mesure", icon: "wand" }],
  },
  ...UPCOMING,
  {
    id: "reglages",
    category: "systeme",
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

/* ───────── Questionnaire de départ : ce que l'entreprise veut faire → apps mises sur l'accueil ───────── */

export type TeamSize = "solo" | "small" | "large";
export const TEAM_SIZES: { value: TeamSize; label: string; hint: string }[] = [
  { value: "solo", label: "Seul", hint: "Indépendant, sans employé" },
  { value: "small", label: "En petite équipe", hint: "De 2 à 10 personnes" },
  { value: "large", label: "Plus de 10 personnes", hint: "PME ou grande entreprise" },
];

export type NeedId = "rdv" | "factures" | "site" | "vendre" | "equipe" | "telephone" | "projets" | "marketing";
export const NEEDS: { id: NeedId; label: string; hint: string; apps: AppId[] }[] = [
  { id: "rdv", label: "Prendre des rendez-vous", hint: "Réservation en ligne, agenda, rappels", apps: ["rdv"] },
  { id: "factures", label: "Faire des devis et des factures", hint: "Et suivre les paiements et les dépenses", apps: ["factures", "depenses", "compta"] },
  { id: "site", label: "Avoir un site internet", hint: "Prêt à l'emploi, ou sur mesure", apps: ["site"] },
  { id: "vendre", label: "Vendre des produits", hint: "En ligne, au comptoir ou à table, avec le stock", apps: ["boutique", "caisse", "commandes", "stock"] },
  { id: "equipe", label: "Gérer mon équipe", hint: "Accès, horaires, congés, paie", apps: ["employes", "horaires", "conges", "paie", "messagerie"] },
  { id: "telephone", label: "Ne plus rater d'appels", hint: "Une IA répond quand vous êtes occupé", apps: ["tel-ia"] },
  { id: "projets", label: "Suivre des projets ou chantiers", hint: "Tâches, interventions, documents", apps: ["projets", "interventions", "documents", "signature"] },
  { id: "marketing", label: "Trouver plus de clients", hint: "Prospects, emails, avis Google, fidélité", apps: ["ventes", "marketing", "avis", "fidelite"] },
];

/** Apps toujours sur l'accueil, quelles que soient les réponses. */
export const ALWAYS_SHOWN: AppId[] = ["clients", "sur-mesure", "reglages"];

/** Apps à ranger hors de l'accueil selon les réponses (seul : pas d'apps d'équipe sauf si demandées). */
export function hiddenAppsFor(teamSize: TeamSize, needs: NeedId[]): AppId[] {
  // Rien de coché : tout reste sur l'accueil (sauf les apps d'équipe pour un indépendant seul).
  if (needs.length === 0) return teamSize === "solo" ? [...NEEDS.find((n) => n.id === "equipe")!.apps] : [];
  const shown = new Set<AppId>(ALWAYS_SHOWN);
  for (const n of NEEDS) if (needs.includes(n.id)) n.apps.forEach((a) => shown.add(a));
  if (teamSize !== "solo") shown.add("employes");
  return APPS.map((a) => a.id).filter((id) => !shown.has(id));
}

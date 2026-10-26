/**
 * Catalogue des apps de la plateforme Skydev. Ajouter une app = une entrée ici + ses pages sous /app.
 *
 * - `included` : comprise dans l'abonnement unique (Solo / Équipe).
 * - `addon`    : option payante en plus de l'abonnement (coûts à l'usage : minutes de téléphone…).
 * - `quote`    : sur devis (sites et apps sur mesure).
 */
export type AppId = "rdv" | "site" | "factures" | "employes" | "boutique" | "tel-ia" | "sur-mesure";

export type AppIcon = "calendar" | "globe" | "file" | "users" | "bag" | "phone" | "wand";

export type SkyApp = {
  id: AppId;
  name: string;
  tagline: string;
  icon: AppIcon;
  /** Page d'entrée de l'app dans l'espace pro. */
  href: string;
  status: "active" | "soon";
  billing: "included" | "addon" | "quote";
  features: string[];
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
  },
  {
    id: "employes",
    name: "Employés",
    tagline: "Planning, horaires et congés de l'équipe.",
    icon: "users",
    href: "/app/employes",
    status: "soon",
    billing: "included",
    features: ["Planning de la semaine", "Demandes de congés", "Lié à l'agenda RDV", "Chacun voit son planning sur son téléphone"],
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
  },
  {
    id: "sur-mesure",
    name: "Sur mesure",
    tagline: "Un site ou une app construits pour vous.",
    icon: "wand",
    href: "/app/sur-mesure",
    status: "active",
    billing: "quote",
    features: ["Site vitrine ou e-commerce sur mesure", "Application, espace client, CRM", "Maquette avant de commencer", "Prix fixe annoncé à l'avance"],
  },
];

export const appById = (id: AppId) => APPS.find((a) => a.id === id)!;

export const BILLING_LABEL: Record<SkyApp["billing"], string> = {
  included: "Inclus",
  addon: "Option",
  quote: "Sur devis",
};

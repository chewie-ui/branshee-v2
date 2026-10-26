import type { BrandId } from "@/lib/brand";
import type { PermissionKey } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: "today" | "inbox" | "history" | "calendar" | "users" | "scissors" | "team" | "clock" | "globe" | "layout" | "blocks" | "settings" | "help" | "apps" | "file" | "card";
  /** Permission requise pour voir l'entrée (absente = visible par tous les membres). */
  permission?: PermissionKey;
};

export const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: "Quotidien",
    items: [
      { href: "/app", label: "Aujourd'hui", icon: "today" },
      { href: "/app/demandes", label: "Demandes", icon: "inbox", permission: "appointments.manage" },
      { href: "/app/agenda", label: "Agenda", icon: "calendar", permission: "appointments.view" },
      { href: "/app/historique", label: "Historique", icon: "history", permission: "appointments.view" },
      { href: "/app/clients", label: "Clients", icon: "users", permission: "customers.view" },
    ],
  },
  {
    label: "Organisation",
    items: [
      { href: "/app/prestations", label: "Prestations", icon: "scissors", permission: "services.view" },
      { href: "/app/equipe", label: "Équipe", icon: "team", permission: "team.view" },
      { href: "/app/horaires", label: "Horaires", icon: "clock" },
    ],
  },
  {
    label: "En ligne",
    items: [
      { href: "/app/page-de-reservation", label: "Page de réservation", icon: "globe", permission: "customization.manage" },
      { href: "/app/site", label: "Site web", icon: "layout", permission: "customization.manage" },
      { href: "/app/apps", label: "Toutes les apps", icon: "apps" },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { href: "/app/reglages", label: "Réglages", icon: "settings", permission: "settings.manage" },
  { href: "/app/aide", label: "Aide et support", icon: "help" },
];

/**
 * Navigation Skydev : l'accueil est le lanceur d'apps, puis les pages regroupées par app.
 * Clients et Équipe sont communs à toutes les apps.
 */
export const SKYDEV_NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  { label: null, items: [{ href: "/app", label: "Accueil", icon: "apps" }] },
  {
    label: "RDV",
    items: [
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
    label: "Votre entreprise",
    items: [
      { href: "/app/clients", label: "Clients", icon: "users", permission: "customers.view" },
      { href: "/app/equipe", label: "Équipe", icon: "team", permission: "team.view" },
      { href: "/app/site", label: "Site web", icon: "layout", permission: "customization.manage" },
      { href: "/app/factures", label: "Factures", icon: "file" },
      { href: "/app/reglages/abonnement", label: "Abonnement", icon: "card", permission: "billing.manage" },
    ],
  },
];

export const navGroupsFor = (brand: BrandId) => (brand === "skydev" ? SKYDEV_NAV_GROUPS : NAV_GROUPS);

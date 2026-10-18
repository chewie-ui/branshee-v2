/** Pages pilotables depuis le super-admin (maintenance, erreur, désactivée). */
export const PAGE_FEATURES = [
  { key: "home", label: "Page d'accueil (/)" },
  { key: "search", label: "Annuaire / recherche d'établissements" },
  { key: "register", label: "Inscription" },
  { key: "login", label: "Connexion" },
  { key: "booking_page", label: "Pages de réservation (profils pros)" },
  { key: "admin_panel", label: "Espace pro" },
  { key: "subscription", label: "Abonnement / paiement" },
] as const;

/** Fonctionnalités de l'espace pro activables / désactivables (actives par défaut). */
export const APP_FEATURES = [
  { key: "group_sessions", label: "Cours collectifs" },
  { key: "buffer_time", label: "Temps de battement entre les RDV" },
] as const;

/** Interrupteurs « cachés » : désactivés tant qu'ils ne sont pas allumés (comme l'ancien Branshee). */
export const HIDDEN_FEATURES = [{ key: "sms_notifications", label: "Notifications SMS / WhatsApp" }] as const;

export type FeatureStatus = "active" | "maintenance" | "error" | "disabled";
export const STATUS_LABELS: Record<FeatureStatus, string> = { active: "En ligne", maintenance: "En maintenance", error: "Erreur temporaire", disabled: "Désactivée" };
/** Clé d'un lien du menu de l'espace pro masquable, ex. « nav:/app/site ». */
export const navKey = (href: string) => `nav:${href}`;

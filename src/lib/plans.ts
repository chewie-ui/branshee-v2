/**
 * Forfaits Branshee : prix affichés et limites. Source unique, partagée serveur / interface.
 * Pas de forfait gratuit : chaque compte a 30 jours d'essai du forfait Pro (sans carte), puis il faut s'abonner.
 * La clé « free » désigne un établissement sans abonnement actif : sa réservation en ligne est fermée.
 * Prix TVA comprise (TVA belge 21 % incluse) ; ils doivent correspondre aux prix Stripe (STRIPE_PRICE_*).
 */
export type Plan = "free" | "pro" | "pro_plus";
export const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, pro_plus: 2 };

/** `monthly` : prix mensuel TVAC ; `yearly` : prix annuel TVAC (environ -20 %). */
export const PLANS: Record<Plan, { label: string; monthly: number; yearly: number; tagline: string }> = {
  free: { label: "Sans abonnement", monthly: 0, yearly: 0, tagline: "Réservation en ligne fermée" },
  pro: { label: "Pro", monthly: 23, yearly: 220, tagline: "Pour un indépendant qui se lance pour de bon" },
  pro_plus: { label: "Pro+", monthly: 59.5, yearly: 570, tagline: "Pour un cabinet avec une équipe" },
};

/** TVA belge, comprise dans tous les prix affichés et facturés. */
export const VAT_RATE = 0.21;
/** « 23 € », « 59,50 € », « 18,33 € » : montant en euros, décimales seulement si nécessaires. */
export const eur = (euros: number) => `${Number.isInteger(euros) ? euros : euros.toFixed(2).replace(".", ",")} €`;
/** Part hors TVA d'un prix TVAC, formatée (« 19,01 € »). */
export const excludingVat = (euros: number) => `${(Math.round((euros / (1 + VAT_RATE)) * 100) / 100).toFixed(2).replace(".", ",")} €`;

/** Durée de l'essai gratuit du forfait Pro, offert au premier établissement d'un compte. */
export const TRIAL_DAYS = 30;

export const ADDONS = {
  customUrl: { label: "URL personnalisée", monthly: 6 },
  seat: { label: "Siège collaborateur", monthly: 12 },
} as const;

const INF = Number.POSITIVE_INFINITY;

export const LIMITS = {
  /** Prestations actives. */
  services: { free: 5, pro: INF, pro_plus: INF },
  /** Collaborateurs inclus (le propriétaire ne compte pas) ; sièges en plus à partir de Pro. */
  collaborators: { free: 0, pro: 2, pro_plus: 10 },
  /** Questions du formulaire de réservation. */
  formQuestions: { free: 1, pro: 5, pro_plus: 10 },
  /** Confirmation automatique jusqu'à N RDV en ligne par mois ; au-delà, « à confirmer » (rien n'est bloqué). */
  autoConfirmUpTo: { free: 20, pro: INF, pro_plus: INF },
  /** SMS inclus par mois. */
  smsIncluded: { free: 0, pro: 10, pro_plus: 30 },
  /** Historique visible (jours) ; les RDV ne sont jamais supprimés, seulement masqués. */
  historyDays: { free: INF, pro: INF, pro_plus: INF },
} satisfies Record<string, Record<Plan, number>>;

export const FEATURES = {
  emailReminders: "pro",
  customization: "pro",
  socialLinks: "pro",
  advancedAvailability: "pro",
  googleCalendar: "pro",
  grades: "pro_plus",
  activityLog: "pro_plus",
  mySite: "pro_plus",
  customUrl: "pro_plus",
  noBranding: "pro_plus",
} as const satisfies Record<string, Plan>;
export type Feature = keyof typeof FEATURES;

export const FEATURE_LABELS: Record<Feature, string> = {
  emailReminders: "Rappels automatiques",
  customization: "Personnalisation de la page",
  socialLinks: "Réseaux sociaux sur votre page",
  advancedAvailability: "Battements et durée des créneaux",
  googleCalendar: "Synchronisation Google Agenda",
  grades: "Grades et permissions",
  activityLog: "Journal d'activité",
  mySite: "Mon site",
  customUrl: "URL personnalisée",
  noBranding: "Sans mention Branshee",
};

export const atLeast = (plan: Plan, required: Plan) => PLAN_RANK[plan] >= PLAN_RANK[required];
export const hasFeature = (plan: Plan, f: Feature, addons: { customUrl?: boolean } = {}) => (f === "customUrl" && addons.customUrl) || atLeast(plan, FEATURES[f]);
export const limitOf = (plan: Plan, key: keyof typeof LIMITS) => LIMITS[key][plan];
export const collaboratorLimit = (plan: Plan, extraSeats: number) => LIMITS.collaborators[plan] + (plan === "free" ? 0 : extraSeats);

/**
 * Peut-on créer un établissement de plus ? Toujours : seul le premier établissement d'un compte
 * a l'essai gratuit, les suivants doivent être abonnés pour ouvrir leur réservation en ligne.
 */
export function canCreateBusiness(ownedPlans: Plan[]) {
  return { ok: true as const, owned: ownedPlans.length };
}

/** Un établissement sans abonnement actif (essai terminé, abonnement arrêté) ne prend plus de réservation en ligne. */
export const bookingOpen = (plan: Plan) => plan !== "free";

export const planLabel = (p: Plan) => PLANS[p].label;

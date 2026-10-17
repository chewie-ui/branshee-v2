/**
 * Forfaits Branshee : prix affichés et limites. Source unique, partagée serveur / interface.
 * Les noms commerciaux (Amateur, Pro, Pro+) sont séparés des clés stockées (free, pro, pro_plus).
 * Les prix doivent correspondre aux prix Stripe (STRIPE_PRICE_* dans l'environnement).
 */
export type Plan = "free" | "pro" | "pro_plus";
export const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, pro_plus: 2 };

export const PLANS: Record<Plan, { label: string; monthly: number; yearlyPerMonth: number; tagline: string }> = {
  free: { label: "Amateur", monthly: 0, yearlyPerMonth: 0, tagline: "Pour démarrer" },
  pro: { label: "Pro", monthly: 19, yearlyPerMonth: 15, tagline: "Pour un indépendant qui se lance pour de bon" },
  pro_plus: { label: "Pro+", monthly: 49, yearlyPerMonth: 39, tagline: "Pour un cabinet avec une équipe" },
};

export const ADDONS = {
  customUrl: { label: "URL personnalisée", monthly: 5 },
  seat: { label: "Siège collaborateur", monthly: 10 },
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
  historyDays: { free: 7, pro: INF, pro_plus: INF },
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
 * Peut-on créer un établissement de plus ? Un gratuit par compte, plus un gratuit par établissement Pro+ ;
 * au-delà, les établissements existants doivent être payants.
 */
export function canCreateBusiness(ownedPlans: Plan[]) {
  const free = ownedPlans.filter((p) => p === "free").length;
  const allowed = 1 + ownedPlans.filter((p) => p === "pro_plus").length;
  return { ok: free < allowed, free, allowed };
}

export const planLabel = (p: Plan) => PLANS[p].label;

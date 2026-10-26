/**
 * Offre Skydev : un abonnement unique donne accès à toutes les apps incluses, plus des options.
 * Les forfaits Skydev réutilisent les droits internes existants : Solo = « pro », Équipe = « pro_plus ».
 * Prix TVA comprise ; ils doivent correspondre aux prix Stripe (STRIPE_PRICE_SKYDEV_*, voir deploy/stripe-prices.sh).
 */
import type { Plan } from "@/lib/plans";

export type PaidPlan = Exclude<Plan, "free">;

export const SKYDEV_PLANS: Record<PaidPlan, { label: string; monthly: number; yearly: number; tagline: string; features: string[] }> = {
  pro: {
    label: "Solo",
    monthly: 29,
    yearly: 290,
    tagline: "Pour un indépendant",
    features: ["Site web et RDV, puis Factures et Boutique dès leur sortie", "Réservation en ligne illimitée", "Rappels automatiques, 10 SMS par mois", "Jusqu'à 2 collaborateurs"],
  },
  pro_plus: {
    label: "Équipe",
    monthly: 59,
    yearly: 590,
    tagline: "Cabinet, salon, PME",
    features: ["Tout Solo", "Employés (bientôt) : planning, horaires, congés", "Jusqu'à 10 collaborateurs, grades et journal d'activité", "30 SMS par mois, votre site sans mention Skydev"],
  },
};

/** Options facturées sur le même abonnement. `kind: "module"` = app en option (table business_modules). */
export type SkydevAddonKey = "tel_ia" | "domain" | "seat";

export const SKYDEV_ADDONS: Record<SkydevAddonKey, { label: string; monthly: number; description: string; unit?: string }> = {
  tel_ia: { label: "Tél IA", monthly: 39, description: "Une IA répond à vos appels manqués et vous envoie le résumé. 100 minutes par mois incluses." },
  domain: { label: "Votre nom de domaine", monthly: 6, description: "Votre site et votre page de réservation sur votre propre adresse (ex. votre-cabinet.be)." },
  seat: { label: "Utilisateur en plus", monthly: 12, description: "Un collaborateur de plus que ce que votre forfait inclut.", unit: "utilisateur" },
};

/** Clé de module (table `modules`) des options qui sont des apps. */
export const MODULE_ADDONS = ["tel_ia"] as const;
export type ModuleAddon = (typeof MODULE_ADDONS)[number];

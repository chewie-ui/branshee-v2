/**
 * Offre Skydev : un seul abonnement pour toutes les apps incluses, facturé par utilisateur avec un prix dégressif
 * (le 1er utilisateur 29 €, puis chaque personne ajoutée coûte un peu moins, jamais moins de 15 €), plus des options.
 * Prix TVA comprise ; ils doivent correspondre aux prix Stripe gradués (STRIPE_PRICE_SKYDEV_MONTHLY / _YEARLY,
 * voir deploy/stripe-prices.sh). En interne, l'abonnement Skydev donne les droits du forfait « pro_plus ».
 */
import type { Plan } from "@/lib/plans";

export type PaidPlan = Exclude<Plan, "free">;

/** Forfait interne donné par l'abonnement Skydev (toutes les fonctionnalités). */
export const SKYDEV_PLAN: PaidPlan = "pro_plus";
export const SKYDEV_NAME = "Skydev";

/** Prix mensuel TVAC du n-ième utilisateur (1er, 2e, 3e…). Le dernier palier vaut pour tous les suivants. */
export const USER_TIERS = [29, 25, 22, 20, 18, 16, 15] as const;
export const MIN_USER_PRICE = USER_TIERS[USER_TIERS.length - 1];
/** Paiement annuel : 10 mois payés, 2 offerts. */
export const YEARLY_MONTHS = 10;
export const MAX_USERS = 200;

export const userPrice = (n: number) => USER_TIERS[Math.min(Math.max(n, 1), USER_TIERS.length) - 1];

/** Détail du prix pour `users` utilisateurs : prix de chacun, total mensuel et annuel (TVAC, en euros). */
export function skydevPrice(users: number) {
  const n = Math.min(Math.max(Math.round(users) || 1, 1), MAX_USERS);
  const lines = Array.from({ length: n }, (_, i) => userPrice(i + 1));
  const monthly = lines.reduce((a, b) => a + b, 0);
  return { users: n, lines, monthly, yearly: monthly * YEARLY_MONTHS, perUser: monthly / n };
}

/** Paliers groupés pour l'affichage : « 1er : 29 € », « 2e : 25 € »… « 7e et suivants : 15 € ». */
export function tierLabels() {
  return USER_TIERS.map((price, i) => ({
    label: i === USER_TIERS.length - 1 ? `${i + 1}e et suivants` : i === 0 ? "1er utilisateur" : `${i + 1}e`,
    price,
  }));
}

export const SKYDEV_FEATURES = [
  "Toutes les apps : RDV, Clients, Site web, Factures, Employés…",
  "Réservation en ligne et rendez-vous illimités",
  "Rappels automatiques, 30 SMS par mois inclus",
  "Grades, accès et journal d'activité",
  "Les nouvelles apps incluses dès leur sortie",
];

/** Options facturées sur le même abonnement. `tel_ia` est une app en option (table business_modules). */
export type SkydevAddonKey = "tel_ia" | "domain";

export const SKYDEV_ADDONS: Record<SkydevAddonKey, { label: string; monthly: number; description: string }> = {
  tel_ia: { label: "Tél IA", monthly: 39, description: "Une IA répond à vos appels manqués et vous envoie le résumé. 100 minutes par mois incluses." },
  domain: { label: "Votre nom de domaine", monthly: 6, description: "Votre site et votre page de réservation sur votre propre adresse (ex. votre-cabinet.be)." },
};

/** Clé de module (table `modules`) des options qui sont des apps. */
export const MODULE_ADDONS = ["tel_ia"] as const;
export type ModuleAddon = (typeof MODULE_ADDONS)[number];

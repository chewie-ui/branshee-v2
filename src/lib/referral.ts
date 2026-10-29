/**
 * Règles du parrainage (pures, testées) : 1 filleul qui a payé 2 fois = 1 mois offert au parrain,
 * au plus 12 mois gagnés par année civile.
 */
export const REFERRAL_MONTHS_PER_FRIEND = 1;
export const REFERRAL_MAX_PER_YEAR = 12;
export const REFERRAL_MIN_PAYMENTS = 2;

/** Mois gagnés à partir du nombre de filleuls validés, année par année. */
export const referralMonths = (perYear: number[]) => perYear.reduce((a, n) => a + Math.min(REFERRAL_MAX_PER_YEAR, Math.max(0, n) * REFERRAL_MONTHS_PER_FRIEND), 0);

/** Message prêt à partager (WhatsApp, SMS, email). */
export const referralMessage = (brand: string, link: string) =>
  `Salut ! J'utilise ${brand} pour gérer mon activité (rendez-vous, factures, site, équipe… tout au même endroit). Je te le conseille, l'essai est gratuit et sans carte : ${link}`;

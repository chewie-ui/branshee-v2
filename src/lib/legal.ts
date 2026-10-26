/**
 * Identité légale de l'éditeur (obligatoire sur le site et sur les factures, Code de droit économique belge).
 * Branshee est la dénomination commerciale de l'entreprise personne physique de Quentin Rennies.
 */
export const LEGAL = {
  owner: "Quentin Rennies",
  trade: "Branshee",
  street: "Avenue des Bouleaux 9",
  city: "1320 Beauvechain",
  country: "Belgique",
  bce: "1044.474.917",
  vat: "BE 1044.474.917",
  email: "support@branshee.com",
} as const;

export const legalAddress = `${LEGAL.street}, ${LEGAL.city}, ${LEGAL.country}`;

/** Pied de facture Stripe : mentions obligatoires d'une facture belge (identité, adresse, BCE, TVA). */
export const invoiceFooter = `${LEGAL.trade} — ${LEGAL.owner}, entreprise personne physique · ${legalAddress} · N° d'entreprise (BCE) ${LEGAL.bce} · TVA ${LEGAL.vat} · ${LEGAL.email}`;

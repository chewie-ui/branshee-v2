/** App Dépenses : catégories et calculs (purs). Montants en centimes. */
export const EXPENSE_CATEGORIES = [
  "Achats de marchandises",
  "Matériel et équipement",
  "Matériel informatique",
  "Logiciels et abonnements",
  "Loyer et charges",
  "Énergie et eau",
  "Téléphone et internet",
  "Véhicule et carburant",
  "Transport et déplacements",
  "Assurances",
  "Honoraires (comptable, avocat…)",
  "Sous-traitance",
  "Publicité et marketing",
  "Hébergement et domaines",
  "Restaurant et réception",
  "Formation",
  "Fournitures de bureau",
  "Frais bancaires",
  "Autre",
] as const;

export const isExpenseCategory = (c: unknown): c is string => typeof c === "string" && (EXPENSE_CATEGORIES as readonly string[]).includes(c);

/** Montant hors TVA d'une dépense. */
export const excl = (e: { amountCents: number; vatCents: number }) => e.amountCents - e.vatCents;

/** TVA à 21 / 12 / 6 % comprise dans un montant TVAC (pour pré-remplir). */
export const vatFromGross = (grossCents: number, rate: number) => Math.round(grossCents - grossCents / (1 + rate / 100));

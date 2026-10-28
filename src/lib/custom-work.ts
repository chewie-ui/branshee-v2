/** Sur mesure : statuts des demandes et catalogue des fonctionnalités activables par client (pur). */
export const REQUEST_STATUS = {
  new: { label: "Reçue", tone: "neutral" },
  quoted: { label: "Prix proposé", tone: "accent" },
  accepted: { label: "Acceptée", tone: "accent" },
  in_progress: { label: "En cours", tone: "warning" },
  done: { label: "Livrée", tone: "success" },
  declined: { label: "Refusée", tone: "danger" },
  cancelled: { label: "Annulée", tone: "neutral" },
} as const;
export type RequestStatus = keyof typeof REQUEST_STATUS;

/**
 * Fonctionnalités sur mesure codées dans Skydev, activables pour une seule entreprise depuis l'admin.
 * Pour en ajouter une : une clé ici, puis dans le code `if (await hasCustomFeature(businessId, "cle"))`.
 */
export const CUSTOM_FEATURES: Record<string, { label: string; app: string }> = {};

export const fmtEuros = (c: number | null | undefined) => (c == null ? null : new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100));

/** Transitions autorisées côté client : accepter ou refuser un prix, annuler une demande pas encore traitée. */
export const clientCan = (status: string, action: "accept" | "decline" | "cancel") =>
  action === "cancel" ? status === "new" || status === "quoted" : status === "quoted";

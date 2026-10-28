/** App Interventions : statuts et montants (pur). */
export const INTERVENTION_STATUS = {
  planned: { label: "Planifiée", next: "onroute", action: "En route" },
  onroute: { label: "En route", next: "working", action: "Commencer" },
  working: { label: "En cours", next: "done", action: "Terminer" },
  done: { label: "Terminée", next: null, action: null },
  cancelled: { label: "Annulée", next: null, action: null },
} as const;
export type InterventionStatus = keyof typeof INTERVENTION_STATUS;
export const isInterventionStatus = (s: unknown): s is InterventionStatus => typeof s === "string" && s in INTERVENTION_STATUS;
export const itemsTotal = (items: { qty: number; unitCents: number }[]) => items.reduce((a, i) => a + Math.round(i.qty * i.unitCents), 0);

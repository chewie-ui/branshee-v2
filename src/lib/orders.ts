/** App Commande à table : statuts et petits calculs (purs). */
export const ORDER_STATUS = {
  new: { label: "Nouvelle", next: "preparing" },
  preparing: { label: "En préparation", next: "ready" },
  ready: { label: "Prête", next: "served" },
  served: { label: "Servie", next: null },
  cancelled: { label: "Annulée", next: null },
} as const;
export type OrderStatus = keyof typeof ORDER_STATUS;
export const isOrderStatus = (s: unknown): s is OrderStatus => typeof s === "string" && s in ORDER_STATUS;

/** Ce que voit le client qui suit sa commande. */
export const CUSTOMER_STATUS: Record<OrderStatus, string> = {
  new: "Commande reçue",
  preparing: "En préparation",
  ready: "Prête, elle arrive",
  served: "Servie. Bon appétit !",
  cancelled: "Commande annulée : adressez-vous au personnel",
};

export const MAX_LINES = 40;
export const MAX_QTY = 20;

export const eur = (cents: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(cents / 100);

/** App Boutique : frais de livraison et statuts (pur, testé). */
export const SHOP_STATUS = {
  pending_payment: { label: "Paiement en attente", next: null },
  new: { label: "Nouvelle", next: "ready" },
  ready: { label: "Prête", next: "done" },
  shipped: { label: "Expédiée", next: "done" },
  done: { label: "Terminée", next: null },
  cancelled: { label: "Annulée", next: null },
} as const;
export type ShopStatus = keyof typeof SHOP_STATUS;
export const isShopStatus = (s: unknown): s is ShopStatus => typeof s === "string" && s in SHOP_STATUS;
export const MAX_SHOP_QTY = 50;

export function deliveryFee(itemsCents: number, s: { deliveryCents: number; freeDeliveryFromCents: number | null }) {
  return s.freeDeliveryFromCents !== null && itemsCents >= s.freeDeliveryFromCents ? 0 : s.deliveryCents;
}

/** Apps Stock et Caisse : calculs purs (testés). Prix de caisse TVAC, en centimes. */
export const VAT_RATES = [21, 12, 6, 0] as const;
export const MOVE_REASONS = { in: "Réception", out: "Sortie", sale: "Vente", refund: "Remboursement", count: "Inventaire" } as const;
export const PAY_METHODS = { cash: "Espèces", card: "Carte / Bancontact", other: "Autre" } as const;
export type PayMethod = keyof typeof PAY_METHODS;

export type CartLine = { qty: number; unitCents: number; vatRate: number };

/** Total TVAC, remise répartie proportionnellement, TVA comprise par taux. */
export function cartTotals(lines: CartLine[], discountCents = 0) {
  const gross = lines.reduce((a, l) => a + l.qty * l.unitCents, 0);
  const discount = Math.max(0, Math.min(discountCents, gross));
  const factor = gross ? (gross - discount) / gross : 0;
  const byRate = new Map<number, { ttc: number; vat: number }>();
  for (const l of lines) {
    const ttc = Math.round(l.qty * l.unitCents * factor);
    const vat = Math.round(ttc - ttc / (1 + l.vatRate / 100));
    const cur = byRate.get(l.vatRate) ?? { ttc: 0, vat: 0 };
    byRate.set(l.vatRate, { ttc: cur.ttc + ttc, vat: cur.vat + vat });
  }
  const total = gross - discount;
  const vat = [...byRate.values()].reduce((a, r) => a + r.vat, 0);
  return { gross, discount, total, vat, byRate: [...byRate].sort((a, b) => b[0] - a[0]).map(([rate, r]) => ({ rate, ...r })) };
}

/** Monnaie à rendre (null si le montant donné ne suffit pas). */
export const changeDue = (totalCents: number, givenCents: number) => (givenCents >= totalCents ? givenCents - totalCents : null);

/** Numéro de ticket : T2026-000042. */
export const ticketNumber = (year: number, seq: number) => `T${year}-${String(seq).padStart(6, "0")}`;

/** « 12,50 » ou « 12.5 » → 1250 ; null si invalide. */
export function parseEuros(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export const isLow = (p: { trackStock: boolean; stockQty: number; minQty: number | null }) => p.trackStock && p.minQty !== null && p.stockQty <= p.minQty;

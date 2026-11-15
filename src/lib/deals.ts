import { z } from "@/lib/zod";

/**
 * Promos de la boutique en ligne — un seul calcul, utilisé par le panier (affichage) et par le serveur (prix réel).
 *
 *  - « buyget » : à l'achat de N articles parmi A, M articles parmi B à −X % (100 = offert).
 *       1 acheté = 1 offert            → A = B = boissons, N = 1, M = 1, X = 100
 *       1 sandwich = −50 % sur un café → A = sandwichs, B = cafés, N = 1, M = 1, X = 50
 *       3 achetés, le 4e offert        → A = B, N = 3, M = 1, X = 100
 *  - « menu » : une formule à prix fixe ; le client choisit un produit par emplacement
 *       (ex. Sandwich au choix + Boisson + Dessert = 8,50 €).
 *
 * « Cible » = des produits précis et/ou des catégories entières (vide = toute la boutique).
 * Un article ne profite que d'une seule promo ; les articles d'un menu n'en profitent pas (le menu est déjà une remise).
 */
export type DealTarget = { products: string[]; categories: string[] };
export type MenuSlot = { id: string; label: string; target: DealTarget };
export type Deal =
  | { id: string; kind: "buyget"; name: string; active: boolean; startsOn: string | null; endsOn: string | null; buyQty: number; buy: DealTarget; getQty: number; get: DealTarget; percent: number; maxPerOrder: number | null }
  | { id: string; kind: "menu"; name: string; active: boolean; startsOn: string | null; endsOn: string | null; description: string; priceCents: number; vatRate: number; slots: MenuSlot[] };

const id = z.string().regex(/^[a-z0-9]{4,16}$/);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const target = z.object({ products: z.array(z.uuid()).max(300), categories: z.array(z.string().trim().min(1).max(60)).max(50) });
const base = { id, name: z.string().trim().min(2, "Donnez un nom à l'offre.").max(80), active: z.boolean(), startsOn: day, endsOn: day };
export const dealSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("buyget"), buyQty: z.number().int().min(1).max(20), buy: target, getQty: z.number().int().min(1).max(20), get: target, percent: z.number().int().min(1, "La remise doit être d'au moins 1 %.").max(100), maxPerOrder: z.number().int().min(1).max(50).nullable() }),
  z.object({
    ...base,
    kind: z.literal("menu"),
    description: z.string().trim().max(300),
    priceCents: z.number().int().min(50, "Prix du menu invalide.").max(100000),
    vatRate: z.number().int().min(0).max(21),
    slots: z.array(z.object({ id, label: z.string().trim().min(1, "Nommez chaque élément du menu (ex. Boisson).").max(40), target })).min(2, "Un menu combine au moins 2 éléments.").max(8),
  }),
]);
export const dealsSchema = z.array(dealSchema).max(60);

export const newDealId = () => Math.random().toString(36).slice(2, 10).padEnd(6, "0");

/** Offre en cours (active, et dans ses dates — jours au fuseau belge). */
export function dealLive(d: Deal, today: string) {
  return d.active && (!d.startsOn || d.startsOn <= today) && (!d.endsOn || today <= d.endsOn);
}
export const todayBrussels = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

export function inTarget(t: DealTarget, p: { id: string; category: string | null }) {
  if (!t.products.length && !t.categories.length) return true;
  return t.products.includes(p.id) || (!!p.category && t.categories.includes(p.category));
}

type Unit = { productId: string; category: string | null; cents: number; vatRate: number };
export type Discount = { dealId: string; name: string; cents: number; vatRate: number };

/**
 * Remises des offres « buyget » sur les articles du panier (hors menus). Par tour : les N déclencheurs les plus chers,
 * puis les M cibles les moins chères (jamais les mêmes articles) ; chaque article ne sert qu'une fois, toutes offres confondues.
 */
export function computeDiscounts(units: Unit[], deals: Deal[], today: string): Discount[] {
  const used = new Set<number>();
  const out: Discount[] = [];
  const sorted = units.map((u, i) => ({ ...u, i }));
  for (const d of deals) {
    if (d.kind !== "buyget" || !dealLive(d, today)) continue;
    const byRate = new Map<number, number>();
    let rounds = 0;
    for (;;) {
      if (d.maxPerOrder && rounds >= d.maxPerOrder) break;
      const trig = sorted.filter((u) => !used.has(u.i) && inTarget(d.buy, { id: u.productId, category: u.category })).sort((a, b) => b.cents - a.cents).slice(0, d.buyQty);
      if (trig.length < d.buyQty) break;
      const taken = new Set(trig.map((u) => u.i));
      const tgt = sorted.filter((u) => !used.has(u.i) && !taken.has(u.i) && inTarget(d.get, { id: u.productId, category: u.category })).sort((a, b) => a.cents - b.cents).slice(0, d.getQty);
      if (tgt.length < d.getQty) break;
      for (const u of [...trig, ...tgt]) used.add(u.i);
      for (const u of tgt) byRate.set(u.vatRate, (byRate.get(u.vatRate) ?? 0) + Math.round((u.cents * d.percent) / 100));
      rounds++;
    }
    for (const [vatRate, cents] of byRate) if (cents > 0) out.push({ dealId: d.id, name: d.name, cents, vatRate });
  }
  return out;
}

/** Explose des lignes (produit, quantité, prix unitaire) en articles unitaires pour le calcul. */
export function toUnits(lines: { productId: string; category: string | null; unitCents: number; vatRate: number; qty: number }[]): Unit[] {
  return lines.flatMap((l) => Array.from({ length: l.qty }, () => ({ productId: l.productId, category: l.category, cents: l.unitCents, vatRate: l.vatRate })));
}

/** Texte court d'une offre pour la vitrine (« 1 acheté = 1 offert », « −50 % sur le 2e »…). */
export function dealBadge(d: Extract<Deal, { kind: "buyget" }>, fr = true) {
  const free = d.percent === 100;
  if (!fr) return free ? `Buy ${d.buyQty}, get ${d.getQty} free` : `Buy ${d.buyQty}, get ${d.getQty} at −${d.percent}%`;
  return free ? `${d.buyQty} acheté${d.buyQty > 1 ? "s" : ""} = ${d.getQty} offert${d.getQty > 1 ? "s" : ""}` : `${d.buyQty} acheté${d.buyQty > 1 ? "s" : ""} = −${d.percent} % sur ${d.getQty}`;
}

import { z } from "@/lib/zod";
import { inTarget, type DealTarget } from "@/lib/deals";

/**
 * Tampons gagnés avec un achat sur la boutique en ligne — la règle est choisie par le commerçant :
 *  - « order »  : N tampons par commande (si la commande contient un produit concerné et atteint le minimum)
 *  - « item »   : 1 tampon par article concerné (ex. 1 tampon par sandwich), au-dessus d'un prix minimum
 *  - « amount » : 1 tampon tous les X € dépensés en produits concernés
 * Produits concernés = catégories et/ou produits précis (vide = toute la boutique).
 */
export type ShopRule = { mode: "order" | "item" | "amount"; target: DealTarget; perOrder: number; minCents: number; perCents: number; maxPerOrder: number | null; menus: boolean };

export const DEFAULT_SHOP_RULE: ShopRule = { mode: "order", target: { products: [], categories: [] }, perOrder: 1, minCents: 0, perCents: 1000, maxPerOrder: null, menus: true };

export const shopRuleSchema = z.object({
  mode: z.enum(["order", "item", "amount"]),
  target: z.object({ products: z.array(z.uuid()).max(300), categories: z.array(z.string().trim().min(1).max(60)).max(50) }),
  perOrder: z.number().int().min(1).max(10),
  minCents: z.number().int().min(0).max(100000),
  perCents: z.number().int().min(100, "Au moins 1 € par tampon.").max(100000),
  maxPerOrder: z.number().int().min(1).max(50).nullable(),
  menus: z.boolean(),
});

export function resolveShopRule(stored: unknown): ShopRule {
  const p = shopRuleSchema.safeParse({ ...DEFAULT_SHOP_RULE, ...((stored && typeof stored === "object" ? stored : {}) as object) });
  return p.success ? p.data : DEFAULT_SHOP_RULE;
}

type Line = { productId: string; category: string | null; unitCents: number; qty: number };

/** Nombre de tampons d'une commande selon la règle (les lignes « Promo » négatives sont ignorées ; menus selon le réglage). */
export function stampsForOrder(rule: ShopRule, lines: Line[]): number {
  const ok = lines.filter((l) => l.unitCents > 0 && (l.productId ? inTarget(rule.target, { id: l.productId, category: l.category }) : rule.menus));
  let n = 0;
  if (rule.mode === "order") {
    const total = ok.reduce((a, l) => a + l.unitCents * l.qty, 0);
    n = ok.length && total >= rule.minCents ? rule.perOrder : 0;
  } else if (rule.mode === "item") {
    n = ok.filter((l) => l.unitCents >= rule.minCents).reduce((a, l) => a + l.qty, 0);
  } else {
    n = Math.floor(ok.reduce((a, l) => a + l.unitCents * l.qty, 0) / rule.perCents);
  }
  return rule.maxPerOrder ? Math.min(n, rule.maxPerOrder) : n;
}

/** Phrase lisible de la règle (réglages et page du client). */
export function describeRule(r: ShopRule, eur: (c: number) => string, targetLabel: string) {
  const on = targetLabel ? ` (${targetLabel})` : "";
  if (r.mode === "order") return `${r.perOrder} tampon${r.perOrder > 1 ? "s" : ""} par commande${on}${r.minCents ? ` dès ${eur(r.minCents)}` : ""}`;
  if (r.mode === "item") return `1 tampon par article${on}${r.minCents ? ` à partir de ${eur(r.minCents)}` : ""}`;
  return `1 tampon tous les ${eur(r.perCents)} dépensés${on}`;
}

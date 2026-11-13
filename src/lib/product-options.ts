import { z } from "@/lib/zod";

/**
 * Options d'un produit à la commande (boutique en ligne) — ex. un sandwich :
 *  - « Pain » : un seul choix obligatoire (blanc, gris, ciabatta +0,50 €)
 *  - « Garnitures » : plusieurs choix (jusqu'à 4), chacun avec son prix
 *  - « Retirer » : plusieurs choix gratuits (sans oignon, sans sauce)
 *  - « Suppléments » : plusieurs choix payants (+ cheddar 0,80 €)
 * Un sandwich « à composer » = un produit à prix de base avec des groupes obligatoires.
 */
export type OptionChoice = { id: string; name: string; priceCents: number };
export type OptionGroup = { id: string; name: string; multi: boolean; required: boolean; max: number | null; choices: OptionChoice[] };

const idRe = /^[a-z0-9]{4,16}$/;
export const optionGroupsSchema = z
  .array(
    z.object({
      id: z.string().regex(idRe),
      name: z.string().trim().min(1, "Donnez un nom à chaque groupe d'options.").max(60),
      multi: z.boolean(),
      required: z.boolean(),
      max: z.number().int().min(1).max(30).nullable(),
      choices: z
        .array(z.object({ id: z.string().regex(idRe), name: z.string().trim().min(1, "Chaque choix a besoin d'un nom.").max(60), priceCents: z.number().int().min(0).max(100000) }))
        .min(1, "Chaque groupe d'options a besoin d'au moins un choix.")
        .max(40),
    }),
  )
  .max(12);

export const newOptionId = () => Math.random().toString(36).slice(2, 10).padEnd(6, "0");

/** Vérifie une sélection et calcule le supplément ; null = sélection invalide (choix inconnu, obligatoire manquant, trop de choix). */
export function priceSelection(groups: OptionGroup[], picked: string[]): { extraCents: number; label: string } | null {
  const set = new Set(picked);
  const known = new Set(groups.flatMap((g) => g.choices.map((c) => c.id)));
  if ([...set].some((id) => !known.has(id))) return null;
  let extra = 0;
  const parts: string[] = [];
  for (const g of groups) {
    const chosen = g.choices.filter((c) => set.has(c.id));
    if (g.required && chosen.length === 0) return null;
    if (!g.multi && chosen.length > 1) return null;
    if (g.multi && g.max && chosen.length > g.max) return null;
    for (const c of chosen) extra += c.priceCents;
    if (chosen.length) parts.push(`${g.name} : ${chosen.map((c) => c.name).join(", ")}`);
  }
  return { extraCents: extra, label: parts.join(" · ") };
}

/** Promo active : prix promo inférieur au prix normal, et pas encore terminée. */
export function promoPrice(p: { priceCents: number; promoCents: number | null; promoUntil: Date | string | null }, now = new Date()) {
  if (p.promoCents == null || p.promoCents >= p.priceCents) return null;
  if (p.promoUntil && new Date(p.promoUntil) <= now) return null;
  return p.promoCents;
}

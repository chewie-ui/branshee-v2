/**
 * Grilles de tailles (vêtements, chaussures, enfants…) avec les équivalences internationales
 * affichées à côté de chaque taille. Les correspondances sont indicatives : elles varient selon les marques.
 */

export type SizeOption = { value: string; hint?: string };
export type SizeGrid = { id: string; label: string; help: string; sizes: SizeOption[] };

const shoesAdult: [string, string, string, string][] = [
  // EU, UK, US femme, US homme
  ["35", "2,5", "5", "3,5"],
  ["36", "3,5", "6", "4,5"],
  ["37", "4", "6,5", "5"],
  ["38", "5", "7,5", "6"],
  ["39", "6", "8,5", "7"],
  ["40", "6,5", "9", "7,5"],
  ["41", "7,5", "10", "8,5"],
  ["42", "8", "10,5", "9"],
  ["43", "9", "11,5", "10"],
  ["44", "9,5", "12", "10,5"],
  ["45", "10,5", "13", "11,5"],
  ["46", "11", "13,5", "12"],
  ["47", "12", "14,5", "13"],
  ["48", "13", "15,5", "14"],
];

export const SIZE_GRIDS: SizeGrid[] = [
  {
    id: "letters",
    label: "Vêtements (XS, S, M…)",
    help: "Tailles internationales, les mêmes en Europe et aux États-Unis.",
    sizes: ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"].map((value) => ({ value })),
  },
  {
    id: "women",
    label: "Femme (34, 36, 38…)",
    help: "Tailles européennes (FR/BE), avec l'équivalent américain, britannique et en lettres.",
    sizes: [
      ["32", "US 0 · UK 4 · XXS"],
      ["34", "US 2 · UK 6 · XS"],
      ["36", "US 4 · UK 8 · S"],
      ["38", "US 6 · UK 10 · M"],
      ["40", "US 8 · UK 12 · L"],
      ["42", "US 10 · UK 14 · XL"],
      ["44", "US 12 · UK 16 · XXL"],
      ["46", "US 14 · UK 18 · 3XL"],
      ["48", "US 16 · UK 20 · 4XL"],
      ["50", "US 18 · UK 22"],
      ["52", "US 20 · UK 24"],
    ].map(([value, hint]) => ({ value: value!, hint })),
  },
  {
    id: "men",
    label: "Homme (46, 48, 50…)",
    help: "Tailles européennes de vestes et costumes, avec l'équivalent américain/britannique (tour de poitrine en pouces) et en lettres.",
    sizes: [
      ["44", "US/UK 34 · XS"],
      ["46", "US/UK 36 · S"],
      ["48", "US/UK 38 · M"],
      ["50", "US/UK 40 · L"],
      ["52", "US/UK 42 · XL"],
      ["54", "US/UK 44 · XXL"],
      ["56", "US/UK 46 · 3XL"],
      ["58", "US/UK 48 · 4XL"],
      ["60", "US/UK 50"],
    ].map(([value, hint]) => ({ value: value!, hint })),
  },
  {
    id: "jeans",
    label: "Jeans (W28, W30…)",
    help: "Tour de taille en pouces (W), avec l'équivalent européen. Ajoutez la longueur (L30, L32…) dans les couleurs si besoin.",
    sizes: [
      ["W26", "EU 34"],
      ["W27", "EU 36"],
      ["W28", "EU 38"],
      ["W29", "EU 38/40"],
      ["W30", "EU 40"],
      ["W31", "EU 42"],
      ["W32", "EU 44"],
      ["W33", "EU 46"],
      ["W34", "EU 48"],
      ["W36", "EU 50"],
      ["W38", "EU 52"],
      ["W40", "EU 54"],
    ].map(([value, hint]) => ({ value: value!, hint })),
  },
  {
    id: "shoes",
    label: "Chaussures adulte (EU 35 à 48)",
    help: "Pointures européennes, avec l'équivalent britannique et américain (femme et homme).",
    sizes: shoesAdult.map(([eu, uk, usw, usm]) => ({ value: eu, hint: `UK ${uk} · US F ${usw} · US H ${usm}` })),
  },
  {
    id: "shoes-kids",
    label: "Chaussures enfant (EU 19 à 34)",
    help: "Pointures européennes pour enfants, avec l'équivalent britannique et américain.",
    sizes: [
      ["19", "UK 3 · US 4"],
      ["20", "UK 4 · US 5"],
      ["21", "UK 5 · US 5,5"],
      ["22", "UK 5,5 · US 6,5"],
      ["23", "UK 6,5 · US 7"],
      ["24", "UK 7 · US 8"],
      ["25", "UK 8 · US 9"],
      ["26", "UK 8,5 · US 9,5"],
      ["27", "UK 9 · US 10"],
      ["28", "UK 10 · US 11"],
      ["29", "UK 11 · US 12"],
      ["30", "UK 11,5 · US 12,5"],
      ["31", "UK 12,5 · US 13"],
      ["32", "UK 13 · US 1"],
      ["33", "UK 1 · US 2"],
      ["34", "UK 2 · US 3"],
    ].map(([value, hint]) => ({ value: value!, hint })),
  },
  {
    id: "kids",
    label: "Enfant (âge)",
    help: "Tailles enfant par âge, avec la stature en centimètres.",
    sizes: [
      ["Naissance", "50 cm"],
      ["1 mois", "56 cm"],
      ["3 mois", "62 cm"],
      ["6 mois", "68 cm"],
      ["12 mois", "74–80 cm"],
      ["18 mois", "86 cm"],
      ["2 ans", "92 cm"],
      ["3 ans", "98 cm"],
      ["4 ans", "104 cm"],
      ["5 ans", "110 cm"],
      ["6 ans", "116 cm"],
      ["8 ans", "128 cm"],
      ["10 ans", "140 cm"],
      ["12 ans", "152 cm"],
      ["14 ans", "164 cm"],
      ["16 ans", "176 cm"],
    ].map(([value, hint]) => ({ value: value!, hint })),
  },
  {
    id: "rings",
    label: "Bagues (tour de doigt)",
    help: "Tailles de bagues européennes (tour de doigt en mm), avec l'équivalent américain.",
    sizes: [
      ["48", "US 4,5"],
      ["50", "US 5,5"],
      ["52", "US 6"],
      ["54", "US 7"],
      ["56", "US 7,5"],
      ["58", "US 8,5"],
      ["60", "US 9"],
      ["62", "US 10"],
      ["64", "US 10,5"],
      ["66", "US 11,5"],
    ].map(([value, hint]) => ({ value: value!, hint })),
  },
  { id: "one", label: "Taille unique", help: "Une seule taille : utile si le produit existe seulement en plusieurs couleurs.", sizes: [{ value: "TU", hint: "Taille unique" }] },
  { id: "custom", label: "Mes propres tailles", help: "Écrivez vos tailles, séparées par des virgules (ex. : 50 ml, 100 ml, 200 ml).", sizes: [] },
];

export const gridById = (id: string | null | undefined) => SIZE_GRIDS.find((g) => g.id === id) ?? null;

/** Équivalences d'une taille (pour l'afficher à côté : « 42 · UK 8 · US H 9 »). */
export function sizeHint(grid: string | null | undefined, size: string | null | undefined) {
  if (!size) return undefined;
  return gridById(grid)?.sizes.find((s) => s.value === size)?.hint;
}

export const COMMON_COLORS = ["Noir", "Blanc", "Gris", "Bleu marine", "Bleu", "Rouge", "Vert", "Beige", "Marron", "Rose", "Jaune", "Orange", "Violet"] as const;

/** Toutes les combinaisons taille × couleur (au moins une taille ou une couleur). */
export function combinations(sizes: string[], colors: string[]) {
  const S = sizes.length ? sizes : [null];
  const C = colors.length ? colors : [null];
  const out: { size: string | null; color: string | null }[] = [];
  for (const s of S) for (const c of C) if (s || c) out.push({ size: s, color: c });
  return out;
}

export const variantLabel = (v: { size: string | null; color: string | null }) => [v.size, v.color].filter(Boolean).join(" / ");
export const variantName = (model: string, v: { size: string | null; color: string | null }) => `${model} — ${variantLabel(v)}`;

/** Ordre d'affichage : l'ordre de la grille de tailles, puis alphabétique. */
export function sortSizes(grid: string | null | undefined, sizes: string[]) {
  const order = gridById(grid)?.sizes.map((s) => s.value) ?? [];
  return [...sizes].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    const na = parseFloat(a.replace(",", ".")), nb = parseFloat(b.replace(",", "."));
    return Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a.localeCompare(b, "fr");
  });
}

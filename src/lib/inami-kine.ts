import { INAMI_CATEGORIES, INAMI_KINE_VERSION, INAMI_PLACES, INAMI_ROWS, type InamiRow } from "./inami-kine-data";

export { INAMI_CATEGORIES, INAMI_KINE_VERSION, INAMI_PLACES };

export type InamiCode = {
  code: string;
  ambCode: string | null;
  hosCode: string | null;
  place: string;
  category: number;
  w: number;
  fee: number;
  intervention: { bimConv: number; bimNonConv: number; conv: number; nonConv: number };
  conventionNote: boolean;
  label: string;
};

const toCode = (r: InamiRow): InamiCode => ({
  code: (r[0] ?? r[1])!,
  ambCode: r[0],
  hosCode: r[1],
  place: r[2],
  category: r[3],
  w: r[4],
  fee: r[5],
  intervention: { bimConv: r[6], bimNonConv: r[7], conv: r[8], nonConv: r[9] },
  conventionNote: r[10] === 1,
  label: r[11],
});

export const INAMI_CODES: InamiCode[] = INAMI_ROWS.map(toCode);
const BY_CODE = new Map<string, InamiCode>();
for (const c of INAMI_CODES) {
  if (c.ambCode) BY_CODE.set(c.ambCode, c);
  if (c.hosCode) BY_CODE.set(c.hosCode, c);
}

/** Prestation INAMI par son code (ambulatoire ou hospitalisé). */
export const inamiCode = (code: string | null | undefined) => (code ? (BY_CODE.get(code.replace(/\D/g, "")) ?? null) : null);

/** Catégorie de l'article 7 § 1 correspondant à la situation de l'épisode (null = toutes). */
export function categoryForPathology(kind: string): number | null {
  return ({ courante: 1, E: 2, perinatal: 4, Fa: 5, Fb: 6, palliatif: 7 } as Record<string, number>)[kind] ?? null;
}

/** Libellé court pour une liste de choix. */
export function shortLabel(c: InamiCode, max = 90) {
  let t = c.label.replace(/^Lorsque (la séance|les séances)[^:]*:\s*/i, "Si séance normale impossible (§ 10) : ").replace(/dans laquelle l’apport personnel du kinésithérapeute par bénéficiaire atteint une durée globale moyenne de/gi, "de")
    .replace(/Séance (individuelle|collective) de kinésithérapie/gi, "Séance $1")
    .replace(/à laquelle participent (\d+) bénéficiaires, dans laquelle l’apport personnel du kinésithérapeute atteint une durée globale moyenne de/gi, "($1 patients),");
  t = t.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Codes proposés pour un lieu et une catégorie (catégorie null = toutes), déplacements inclus. */
export function codesFor(place: string, category: number | null) {
  return INAMI_CODES.filter((c) => c.place === place && (category == null || c.category === category || c.category === 0));
}

/**
 * Bénéficiaire de l’intervention majorée (BIM) d’après le code titulaire CT1 : dernier chiffre 1.
 * Ex. 110/110 = régime général, 111/111 = BIM.
 */
export const isBim = (ct1: string | null | undefined) => !!ct1 && /^\d{3}$/.test(ct1) && ct1[2] === "1";

/** Honoraire, remboursement de la mutuelle et part du patient (ticket modérateur) pour une prestation. */
export function amounts(c: InamiCode, o: { bim: boolean; conventioned: boolean }) {
  const refund = o.bim ? (o.conventioned ? c.intervention.bimConv : c.intervention.bimNonConv) : o.conventioned ? c.intervention.conv : c.intervention.nonConv;
  return { fee: c.fee, refund, patient: Math.round((c.fee - refund) * 100) / 100 };
}

/** Cadrage de la photo d'un produit (boutique) : remplie et recadrée (centre, haut, bas) ou entière (rien n'est coupé). */
export const PHOTO_FITS = ["cover", "cover-top", "cover-bottom", "contain"] as const;
export type PhotoFit = (typeof PHOTO_FITS)[number];
export function photoFitClass(f: string | null | undefined) {
  return f === "contain" ? "object-contain p-2" : f === "cover-top" ? "object-cover object-top" : f === "cover-bottom" ? "object-cover object-bottom" : "object-cover";
}

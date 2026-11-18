/** Mesures de l'examen et du suivi kiné : paramètres prédéfinis (unité, bornes) et paramètre libre. */
export const MEASURES = [
  { key: "eva", label: "Douleur (EVA)", unit: "/10", min: 0, max: 10, sided: false },
  { key: "rom", label: "Amplitude articulaire", unit: "°", min: -90, max: 360, sided: true },
  { key: "mrc", label: "Force musculaire (MRC)", unit: "/5", min: 0, max: 5, sided: true },
  { key: "perimetre", label: "Périmètre", unit: "cm", min: 0, max: 300, sided: true },
  { key: "tm6", label: "Test de marche de 6 minutes", unit: "m", min: 0, max: 1500, sided: false },
  { key: "tug", label: "Timed Up and Go", unit: "s", min: 0, max: 600, sided: false },
  { key: "poids", label: "Poids", unit: "kg", min: 0, max: 400, sided: false },
  { key: "autre", label: "Autre mesure", unit: "", min: null, max: null, sided: true },
] as const;
export type MeasureKey = (typeof MEASURES)[number]["key"];
export const measureDef = (k: string) => MEASURES.find((m) => m.key === k);

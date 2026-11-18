/** Codes standardisés pour le dossier kiné : sélection ICF courante en kinésithérapie, saisie libre des autres systèmes. */
export const ICF_COMMON: { code: string; label: string }[] = [
  { code: "b280", label: "Sensation de douleur" },
  { code: "b28013", label: "Douleur au dos" },
  { code: "b28014", label: "Douleur dans un membre supérieur" },
  { code: "b28015", label: "Douleur dans un membre inférieur" },
  { code: "b28016", label: "Douleur dans les articulations" },
  { code: "b235", label: "Fonctions vestibulaires" },
  { code: "b260", label: "Fonction proprioceptive" },
  { code: "b440", label: "Fonctions respiratoires" },
  { code: "b455", label: "Fonctions de tolérance à l'effort" },
  { code: "b710", label: "Mobilité des articulations" },
  { code: "b715", label: "Stabilité des articulations" },
  { code: "b730", label: "Puissance musculaire" },
  { code: "b735", label: "Tonus musculaire" },
  { code: "b740", label: "Endurance musculaire" },
  { code: "b760", label: "Contrôle des mouvements volontaires" },
  { code: "b770", label: "Type de démarche" },
  { code: "d410", label: "Changer la position corporelle de base" },
  { code: "d415", label: "Maintenir la position du corps" },
  { code: "d430", label: "Soulever et porter des objets" },
  { code: "d440", label: "Activités de motricité fine" },
  { code: "d450", label: "Marcher" },
  { code: "d455", label: "Se déplacer" },
  { code: "d540", label: "S'habiller" },
  { code: "d850", label: "Travail rémunéré" },
  { code: "d920", label: "Récréation et loisirs" },
  { code: "s720", label: "Structure de l'épaule" },
  { code: "s730", label: "Structure du membre supérieur" },
  { code: "s750", label: "Structure du membre inférieur" },
  { code: "s760", label: "Structure du tronc" },
];

export const CODE_SCHEMES = ["ICF", "ICD-10", "ICPC-2", "SNOMED"] as const;
export type CareCode = { scheme: string; code: string; label?: string };

const SCHEME_ALIASES: Record<string, string> = { ICF: "ICF", CIF: "ICF", "ICD-10": "ICD-10", ICD10: "ICD-10", CIM10: "ICD-10", "CIM-10": "ICD-10", ICPC: "ICPC-2", "ICPC-2": "ICPC-2", CISP: "ICPC-2", "CISP-2": "ICPC-2", SNOMED: "SNOMED", "SNOMED-CT": "SNOMED" };

/** « ICF b280, ICD-10 S93.4 ; d450 » → codes structurés (un code ICF sans préfixe est reconnu). */
export function parseCodes(input: string): CareCode[] {
  const out: CareCode[] = [];
  for (const raw of input.split(/[,;\n]+/)) {
    const t = raw.trim();
    if (!t) continue;
    const m = t.match(/^([A-Za-z][A-Za-z0-9-]*)\s*[: ]\s*([A-Za-z0-9.]+)/);
    let scheme = m ? SCHEME_ALIASES[m[1]!.toUpperCase()] : undefined;
    let code = m && scheme ? m[2]! : t.split(/\s/)[0]!;
    if (!scheme) scheme = /^[bdes]\d{3,6}$/i.test(code) ? "ICF" : "";
    if (!scheme || !/^[A-Za-z0-9.]{1,20}$/.test(code)) continue;
    if (scheme === "ICF") code = code.toLowerCase();
    const label = scheme === "ICF" ? ICF_COMMON.find((x) => x.code === code)?.label : undefined;
    if (!out.some((x) => x.scheme === scheme && x.code === code)) out.push({ scheme, code, ...(label ? { label } : {}) });
    if (out.length >= 12) break;
  }
  return out;
}

export const formatCodes = (codes: CareCode[]) => codes.map((c) => `${c.scheme} ${c.code}`).join(", ");

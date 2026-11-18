/** Rôles de l'équipe de soins d'un patient (critère eHealth : au minimum ceux-ci). */
export const CARE_TEAM_ROLES = [
  { key: "gp", label: "Médecin généraliste" },
  { key: "prescriber", label: "Médecin prescripteur" },
  { key: "specialist", label: "Médecin spécialiste" },
  { key: "physio", label: "Kinésithérapeute" },
  { key: "nurse", label: "Infirmier·ère" },
  { key: "care_assistant", label: "Aide-soignant·e" },
  { key: "home_helper", label: "Aide familiale" },
  { key: "hospital", label: "Assistant·e hospitalier·ère" },
  { key: "coordination", label: "Centre de coordination" },
  { key: "other", label: "Autre" },
] as const;

export const careRoleLabel = (k: string) => CARE_TEAM_ROLES.find((r) => r.key === k)?.label ?? k;

/** Documents INAMI disponibles (modèles pré-remplis depuis le dossier). */
export const CARE_DOC_KINDS = [
  { key: "rapport_prescripteur", label: "Rapport au médecin prescripteur", episode: true },
  { key: "rapport_ecrit", label: "Rapport écrit (continuité des soins)", episode: true },
  { key: "seances_supp", label: "Demande de séances supplémentaires", episode: true },
  { key: "notification_fa_fb", label: "Notification pathologie Fa / Fb au médecin-conseil", episode: true },
  { key: "demande_e", label: "Demande d'accord pathologie lourde (liste E)", episode: true },
  { key: "bilan", label: "Rapport de bilan (consultation)", episode: true },
  { key: "historique", label: "Historique des pathologies du patient", episode: false },
  { key: "courrier", label: "Courrier libre", episode: false },
] as const;
export type CareDocKind = (typeof CARE_DOC_KINDS)[number]["key"];
export const careDocLabel = (k: string) => CARE_DOC_KINDS.find((d) => d.key === k)?.label ?? k;
export const isCareDocKind = (k: string): k is CareDocKind => CARE_DOC_KINDS.some((d) => d.key === k);

/** Marque laissée dans un modèle quand une donnée manque au dossier. */
export const TO_FILL = "[à compléter]";

/** Rubriques obligatoires de certains documents : contrôle non bloquant avant validation. */
export const REQUIRED_HEADINGS: Partial<Record<CareDocKind, string[]>> = {
  rapport_prescripteur: ["DIAGNOSTIC KINÉ", "TRAITEMENT", "ÉVOLUTION", "CONCLUSION"],
  rapport_ecrit: ["MOTIF", "DIAGNOSTIC KINÉ", "TRAITEMENT", "ÉVOLUTION", "CONSEILS ET SUITE"],
  seances_supp: ["JUSTIFICATION", "SÉANCES DEMANDÉES"],
  notification_fa_fb: ["PATHOLOGIE", "DATE DE DÉBUT"],
  demande_e: ["PATHOLOGIE", "JUSTIFICATION"],
};

const isHeading = (l: string) => l.length < 60 && /[A-ZÀ-Ý]/.test(l) && !/[a-zà-ÿ]/.test(l);

/**
 * Liste des manques d'un document (rubrique absente ou vide, « [à compléter] » restant).
 * Une rubrique est un paragraphe en majuscules ; son contenu est le paragraphe qui la suit.
 */
export function documentGaps(kind: string, content: string): string[] {
  const gaps: string[] = [];
  const blocks = content.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  for (const h of REQUIRED_HEADINGS[kind as CareDocKind] ?? []) {
    const i = blocks.findIndex((b) => b.toUpperCase() === h && isHeading(b));
    if (i < 0) {
      gaps.push(`Rubrique « ${h} » absente`);
      continue;
    }
    const body = blocks[i + 1];
    if (!body || isHeading(body) || !body.replace(TO_FILL, "").trim()) gaps.push(`Rubrique « ${h} » vide`);
  }
  if (content.includes(TO_FILL)) gaps.push(`Il reste des « ${TO_FILL} »`);
  return gaps;
}

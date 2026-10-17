/**
 * Vocabulaire adapté au métier : un kiné, un psy ou un dentiste parle de « patients »,
 * un coiffeur ou un coach de « clients ». Déduit du métier de l'établissement.
 */
const PATIENT_KEYWORDS = [
  "médecin", "medecin", "docteur", "dentiste", "orthodont", "kinésithérap", "kinesitherap", "kiné", "kine",
  "ostéopath", "osteopath", "chiropract", "psycholog", "psychiatr", "psychothérap", "psychotherap",
  "infirmier", "infirmière", "sage-femme", "podolog", "orthophon", "orthopt", "opticien",
  "diététic", "dietetic", "nutrition", "acupunc", "naturopath", "homéopath", "homeopath",
  "sophrolog", "hypnothérap", "hypnotherap", "ergothérap", "ergotherap", "psychomotric",
  "neurolog", "rhumatolog", "gastroentérolog", "gastroenterolog", "endocrinolog", "allergolog",
  "sexolog", "gériatr", "geriatr", "cardiolog", "dermatolog", "ophtalmolog", "pédiatr", "pediatr",
  "gynécolog", "gynecolog", "vétérin", "veterin",
  "doctor", "physician", "physio", "nurse", "midwife", "podiatr", "speech therapist",
  "dietitian", "huisarts", "tandarts", "kinesitherapeut", "arzt", "zahnarzt", "verpleegkundige",
];

export function isPatientProfession(businessType: string | null | undefined) {
  if (!businessType) return false;
  const lower = businessType.toLowerCase();
  return PATIENT_KEYWORDS.some((kw) => lower.includes(kw));
}

/** « client » ou « patient », au pluriel et/ou avec majuscule si demandé. */
export function clientWord(businessType: string | null | undefined, opts: { plural?: boolean; capitalize?: boolean } = {}) {
  let word = isPatientProfession(businessType) ? "patient" : "client";
  if (opts.plural) word += "s";
  return opts.capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

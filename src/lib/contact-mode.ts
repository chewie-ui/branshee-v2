/**
 * Comment les clients joignent une entreprise depuis ses pages publiques (pur, utilisable côté navigateur).
 * Un seul réglage d'entreprise, respecté partout : site, vitrine, widget de contact, API des sites connectés.
 */
export const CONTACT_MODES = {
  form: { label: "Formulaire de message", desc: "Les visiteurs écrivent un message ; vous répondez par email ou téléphone." },
  callback: { label: "« Rappelez-moi »", desc: "Les visiteurs laissent seulement leur nom et leur numéro ; vous rappelez quand vous voulez. Pas de longs messages." },
  phone: { label: "Appel uniquement", desc: "Aucun formulaire : un bouton pour vous appeler, avec vos horaires. Vous ne recevez aucun message." },
} as const;
export type ContactMode = keyof typeof CONTACT_MODES;
export const isContactMode = (s: unknown): s is ContactMode => typeof s === "string" && s in CONTACT_MODES;
export const contactModeOf = (s: string | null | undefined): ContactMode => (isContactMode(s) ? s : "form");

/** Moment de rappel souhaité (« Rappelez-moi »). */
export const CALLBACK_MOMENTS = { any: "Peu importe", morning: "Le matin", noon: "Sur le temps de midi", afternoon: "L'après-midi", evening: "En fin de journée" } as const;
export type CallbackMoment = keyof typeof CALLBACK_MOMENTS;

/** Numéro belge ou international plausible (chiffres, espaces, +, points, tirets, parenthèses ; 8 à 15 chiffres). */
export function isPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return /^[+\d\s().\/-]{8,25}$/.test(raw.trim()) && digits.length >= 8 && digits.length <= 15;
}

/** Lien tel: propre. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^+0-9]/g, "")}`;

/** Message refusé par un mode qui ne l'accepte pas (réponse claire au visiteur). */
export function blockedMessage(mode: ContactMode, phone: string | null) {
  if (mode === "phone") return phone ? `Ce professionnel préfère être appelé : ${phone}.` : "Ce professionnel préfère être contacté par téléphone.";
  return "Laissez plutôt votre numéro : le professionnel vous rappelle.";
}

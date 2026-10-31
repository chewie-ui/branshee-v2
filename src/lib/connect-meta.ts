/** Droits des clés API et événements des webhooks (utilisable côté navigateur : pas de crypto ici). */
export const SCOPES = {
  rdv: { label: "Rendez-vous", desc: "Lire les prestations et les créneaux libres, créer des réservations." },
  contacts: { label: "Messages et clients", desc: "Envoyer les messages du formulaire de contact (la fiche client est créée)." },
  shop: { label: "Boutique", desc: "Lire les produits en vente en ligne et leur stock." },
  reviews: { label: "Avis", desc: "Lire la note moyenne et les derniers avis." },
  business: { label: "Infos de l'entreprise", desc: "Lire le nom, l'adresse, le téléphone et les horaires." },
} as const;
export type Scope = keyof typeof SCOPES;
export const isScope = (s: unknown): s is Scope => typeof s === "string" && s in SCOPES;

export const EVENTS = {
  "appointment.created": "Nouveau rendez-vous",
  "appointment.cancelled": "Rendez-vous annulé",
  "order.created": "Nouvelle commande en ligne",
  "contact.created": "Nouveau message du formulaire",
} as const;
export type WebhookEvent = keyof typeof EVENTS;
export const isEvent = (s: unknown): s is WebhookEvent => typeof s === "string" && s in EVENTS;


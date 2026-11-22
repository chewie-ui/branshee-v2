/**
 * Guides « Que voulez-vous faire ? » du bouton d'aide présent sur toutes les pages de l'app.
 * Un guide = un objectif concret (publier sa page, envoyer des rappels…) découpé en étapes.
 * Chaque étape ouvre la bonne page, lance une visite guidée (`tour`, voir lib/tours.ts),
 * et peut être cochée automatiquement (`check`, calculé côté serveur dans server/help.ts).
 */
export type HelpCheck = "hours" | "service" | "bookingOn" | "photo" | "linkShared" | "firstBooking" | "emailReminders" | "whatsappReminders" | "phoneRequired" | "team" | "sitePublished" | "shopOn";
export type GuideStep = { label: string; hint: string; href: string; tour?: string; check?: HelpCheck };
/** `needs` : app et droit nécessaires pour suivre le guide (sinon il n'est pas proposé). */
export type HelpGuide = { key: string; title: string; desc: string; keywords: string; paths: string[]; needs: { app?: string; perm?: string }; steps: GuideStep[] };

export const HELP_GUIDES: HelpGuide[] = [
  {
    key: "publishPage",
    title: "Mettre ma page de réservation en ligne",
    desc: "Pour que vos clients prennent rendez-vous seuls, 24 h/24.",
    keywords: "publier page en ligne réservation rendez-vous rdv lien calendrier agenda activer ouvrir partager",
    paths: ["^/app$", "^/app/rdv", "^/app/page-de-reservation", "^/app/horaires", "^/app/prestations"],
    needs: { app: "rdv", perm: "settings.manage" },
    steps: [
      { label: "Indiquez vos horaires", hint: "Les clients ne peuvent réserver que pendant vos heures d'ouverture.", href: "/app/horaires", tour: "availability", check: "hours" },
      { label: "Ajoutez une prestation", hint: "Ce que vos clients réservent : nom, durée, prix.", href: "/app/prestations/nouvelle", tour: "service", check: "service" },
      { label: "Ajoutez votre logo ou une photo", hint: "Votre page inspire confiance et ressort mieux sur Google.", href: "/app/reglages/etablissement", check: "photo" },
      { label: "Vérifiez que la réservation en ligne est activée", hint: "Interrupteur « Réservation en ligne » sur l'accueil, carte « Ma page en ligne ».", href: "/app", check: "bookingOn" },
      { label: "Partagez votre lien", hint: "Copiez-le pour Google, Instagram, WhatsApp, ou imprimez le QR code.", href: "/app/page-de-reservation/partager", check: "linkShared" },
      { label: "Faites un essai", hint: "Réservez vous-même un rendez-vous pour voir ce que voit un client.", href: "/app/page-de-reservation/partager", check: "firstBooking" },
    ],
  },
  {
    key: "reminders",
    title: "Envoyer des rappels de rendez-vous",
    desc: "Moins d'oublis : un rappel automatique avant chaque rendez-vous.",
    keywords: "rappel rappels message sms whatsapp email mail notification oubli absence confirmer prévenir client",
    paths: ["^/app/reglages/notifications", "^/app/reglages/sms", "^/app/rdv", "^/app/agenda"],
    needs: { app: "rdv", perm: "settings.manage" },
    steps: [
      { label: "Le rappel par email est déjà automatique", hint: "Chaque client reçoit un email avant son rendez-vous. Réglez le délai (24 h, 48 h…) et le texte ici.", href: "/app/reglages/notifications", check: "emailReminders" },
      { label: "Activez les rappels par WhatsApp", hint: "Le message arrive sur le téléphone du client : c'est le plus efficace. Inclus dans les forfaits payants.", href: "/app/reglages/sms", check: "whatsappReminders" },
      { label: "Rendez le téléphone obligatoire à la réservation", hint: "Sans numéro, pas de rappel WhatsApp. Réglage « Téléphone obligatoire » dans les règles de réservation.", href: "/app/reglages/reservation", check: "phoneRequired" },
    ],
  },
  {
    key: "team",
    title: "Ajouter un employé",
    desc: "Lui donner son compte, ses horaires et ses droits.",
    keywords: "employé collaborateur équipe membre ajouter inviter grade droit permission accès",
    paths: ["^/app/equipe"],
    needs: { perm: "team.manage" },
    steps: [
      { label: "Ajoutez le membre", hint: "Avec son email, il reçoit une invitation pour créer son accès.", href: "/app/equipe/ajouter", tour: "collaborators", check: "team" },
      { label: "Choisissez son grade", hint: "Le grade décide ce qu'il voit et ce qu'il peut faire, app par app.", href: "/app/equipe/grades" },
      { label: "Réglez ses horaires", hint: "Ses créneaux réservables, différents des vôtres si besoin.", href: "/app/horaires" },
    ],
  },
  {
    key: "daysOff",
    title: "Fermer pour congé ou vacances",
    desc: "Bloquer des jours : plus aucun rendez-vous possible ces jours-là.",
    keywords: "congé congés vacances fermeture fermé férié absent absence bloquer jour",
    paths: ["^/app/horaires", "^/app/conges"],
    needs: { app: "rdv" },
    steps: [{ label: "Ajoutez la période de fermeture", hint: "Horaires › Congés et fermetures : un jour ou une période.", href: "/app/horaires", tour: "daysOff" }],
  },
  {
    key: "site",
    title: "Créer mon site web",
    desc: "Un site vitrine avec la réservation intégrée, à la même adresse.",
    keywords: "site web vitrine internet page google domaine",
    paths: ["^/app/site"],
    needs: { app: "site", perm: "customization.manage" },
    steps: [
      { label: "Choisissez un modèle et vos textes", hint: "Tout est prérempli : modifiez ce que vous voulez.", href: "/app/site" },
      { label: "Publiez le site", hint: "Il remplace votre page de réservation à la même adresse. Vous pouvez le retirer à tout moment.", href: "/app/site", check: "sitePublished" },
    ],
  },
  {
    key: "payments",
    title: "Faire payer en ligne ou demander un acompte",
    desc: "Paiement à la réservation, carte en garantie, politique d'annulation.",
    keywords: "paiement payer acompte carte stripe bancontact annulation garantie absence encaisser",
    paths: ["^/app/reglages/paiements"],
    needs: { perm: "settings.manage" },
    steps: [
      { label: "Connectez votre compte de paiement", hint: "Réglages › Paiements : l'argent arrive directement sur votre compte.", href: "/app/reglages/paiements" },
      { label: "Choisissez votre règle d'annulation", hint: "Une carte est demandée en garantie, rien n'est prélevé sans annulation tardive.", href: "/app/reglages/paiements", tour: "cancellationPolicy" },
    ],
  },
  {
    key: "shop",
    title: "Ouvrir ma boutique en ligne",
    desc: "Vendre vos produits ou bons cadeaux sur votre page.",
    keywords: "boutique vendre produit commande bon cadeau shop en ligne",
    paths: ["^/app/boutique"],
    needs: { app: "boutique" },
    steps: [
      { label: "Ajoutez vos produits", hint: "Photo, prix et stock.", href: "/app/boutique" },
      { label: "Réglez retrait, livraison et paiement", hint: "Au moins un mode de retrait et un moyen de paiement.", href: "/app/boutique/reglages" },
      { label: "Ouvrez la boutique", hint: "Interrupteur « Boutique en ligne » sur l'accueil.", href: "/app", check: "shopOn" },
    ],
  },
  {
    key: "billing",
    title: "Voir mes factures Skydev et ma carte",
    desc: "Télécharger vos factures, changer de carte bancaire.",
    keywords: "facture factures abonnement carte paiement tva skydev prix payer",
    paths: ["^/app/reglages/abonnement", "^/app/reglages/factures"],
    needs: { perm: "billing.manage" },
    steps: [
      { label: "Ouvrez « Factures et cartes »", hint: "Toutes vos factures en PDF, et vos cartes enregistrées.", href: "/app/reglages/factures" },
      { label: "Gérez votre abonnement", hint: "Formule, utilisateurs et options.", href: "/app/reglages/abonnement" },
    ],
  },
];

/** Recherche simple, sans accents ni majuscules, sur le titre, la description et les mots-clés. */
export function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
const STOP = new Set(["les", "des", "une", "pour", "avec", "mes", "mon", "comment", "faire", "veux", "voudrais", "est", "que", "qui", "dans", "sur", "pas", "par", "aux", "son", "ses", "elle", "moi", "fait", "peux", "and", "the"]);

/** Nombre de mots de la recherche trouvés dans le guide (0 = hors sujet). */
export function guideScore(g: { title: string; desc: string; keywords: string }, q: string) {
  const hay = norm(`${g.title} ${g.desc} ${g.keywords}`);
  return norm(q)
    .split(/[\s,.'’?!]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .filter((w) => hay.includes(w) || (w.endsWith("s") && hay.includes(w.slice(0, -1)))).length;
}

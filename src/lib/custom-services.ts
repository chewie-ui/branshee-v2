/**
 * Pages « sur mesure » de skydev.be (sites, apps, logiciels) : contenu, villes desservies et anciennes adresses
 * de l'ancien site Skydev (redirigées en 301 pour garder leur référencement Google).
 */

/** Prix d'appel d'un site vitrine, affiché partout (pages, tarifs). */
export const SITE_FROM_EUR = 690;

export type CustomService = {
  slug: string;
  nom: string;
  titre: string;
  description: string;
  intro: string;
  prix: string;
  points: { t: string; d: string }[];
  faq: { q: string; r: string }[];
  /** Pages par ville (création de site uniquement). */
  villes?: boolean;
};

const COMMON_FAQ = [
  { q: "Comment se passe un projet ?", r: "On en parle 15 minutes (téléphone ou visio), je vous envoie une estimation sous 24 h, puis une maquette avant que vous payiez quoi que ce soit. Le prix est fixe et annoncé avant de commencer." },
  { q: "Est-ce relié à mes outils Skydev ?", r: "Oui, si vous le souhaitez : prise de rendez-vous, boutique, formulaire de contact, avis et factures fonctionnent directement avec votre espace Skydev, de façon sécurisée." },
  { q: "Travaillez-vous seulement dans le Brabant wallon ?", r: "Skydev est basé à Wavre et se déplace volontiers dans tout le Brabant wallon et à Bruxelles, mais tout peut aussi se faire à distance, partout en Belgique." },
];

export const CUSTOM_SERVICES: CustomService[] = [
  {
    slug: "creation-site-internet",
    nom: "Création de site internet",
    titre: "Création de site internet sur mesure",
    description: `Site vitrine sur mesure dès ${SITE_FROM_EUR} € : rapide, adapté au mobile, prêt pour Google et relié à vos rendez-vous. Devis gratuit sous 24 h.`,
    intro: "Un site rapide, beau sur téléphone, pensé pour être trouvé sur Google et pour transformer les visiteurs en clients : demande de devis, prise de rendez-vous ou commande en ligne.",
    prix: `Site vitrine dès ${SITE_FROM_EUR} €`,
    villes: true,
    points: [
      { t: "Sur mesure, pas un modèle", d: "Un design fait pour votre métier et votre image, que vous validez sur une maquette avant de payer." },
      { t: "Prêt pour Google", d: "Pages rapides, textes structurés, fiche Google et données locales soignées pour apparaître dans votre région." },
      { t: "Relié à Skydev", d: "Rendez-vous en ligne, formulaire de contact, avis et boutique branchés sur votre espace, sans copier-coller." },
      { t: "En ligne en une dizaine de jours", d: "Pour un site vitrine classique, une fois les textes et photos réunis." },
    ],
    faq: [{ q: "Combien coûte un site internet ?", r: `Un site vitrine commence à ${SITE_FROM_EUR} €. Le prix final dépend du nombre de pages et des fonctions (réservation, boutique, plusieurs langues) ; il est fixé avant de commencer.` }, ...COMMON_FAQ],
  },
  {
    slug: "refonte-site-internet",
    nom: "Refonte de site internet",
    titre: "Refonte de site internet",
    description: "Votre site est lent, daté ou ne vous apporte pas de clients ? Refonte complète, adaptée au mobile et à Google, en gardant votre référencement.",
    intro: "On repart de votre site actuel : ce qui fonctionne est gardé, le reste est refait pour être rapide, clair et efficace, sans perdre votre place sur Google.",
    prix: "Sur devis, prix fixe",
    points: [
      { t: "Analyse de l'existant", d: "Pages vues, recherches qui vous amènent des visiteurs, points de blocage : on sait quoi garder." },
      { t: "Référencement conservé", d: "Chaque ancienne adresse est redirigée vers la nouvelle page correspondante." },
      { t: "Design moderne", d: "Lisible, rapide, pensé d'abord pour le téléphone." },
      { t: "Relié à vos outils", d: "Rendez-vous, contact et avis connectés à Skydev si vous le voulez." },
    ],
    faq: COMMON_FAQ,
  },
  {
    slug: "boutique-en-ligne",
    nom: "Boutique en ligne",
    titre: "Création de boutique en ligne",
    description: "Boutique en ligne sur mesure, paiement en ligne et stock reliés à votre caisse Skydev. Pour commerçants et artisans en Belgique.",
    intro: "Vendez en ligne avec une boutique à votre image, dont le stock est le même que celui de votre magasin : une vente en ligne ou au comptoir met tout à jour.",
    prix: "Sur devis, prix fixe",
    points: [
      { t: "Paiement en ligne", d: "Paiement sécurisé à la commande, retrait en magasin ou livraison." },
      { t: "Stock unique", d: "Tailles, couleurs et quantités partagées avec la caisse Skydev." },
      { t: "Commandes centralisées", d: "Chaque commande arrive dans votre espace, avec e-mail au client." },
      { t: "Petite ou grande boutique", d: "De quelques produits à un vrai catalogue, avec tailles et couleurs." },
    ],
    faq: COMMON_FAQ,
  },
  {
    slug: "application-web-saas",
    nom: "Application web et SaaS",
    titre: "Développement d'application web et SaaS sur mesure",
    description: "Application web, logiciel métier ou SaaS sur mesure pour indépendants et PME : espace client, outils internes, plateformes en ligne.",
    intro: "Un outil qui n'existe pas encore, ou qui coûte trop cher en abonnements ? On le construit : espace client, outil interne, plateforme en ligne, jusqu'à un SaaS que vous revendez.",
    prix: "Sur devis, prix fixe",
    points: [
      { t: "Pensé pour votre métier", d: "On part de votre façon de travailler, pas d'un logiciel générique." },
      { t: "Sécurisé", d: "Comptes, droits par personne, données chiffrées quand elles sont sensibles, sauvegardes." },
      { t: "Évolutif", d: "On commence par l'essentiel, puis on ajoute ce dont vous avez besoin." },
      { t: "Fait à Wavre", d: "La plateforme Skydev elle-même est développée ainsi, à Wavre." },
    ],
    faq: COMMON_FAQ,
  },
  {
    slug: "application-mobile",
    nom: "Application mobile",
    titre: "Création d'application mobile",
    description: "Application mobile iPhone et Android sur mesure pour votre entreprise : réservation, fidélité, suivi client, outil terrain.",
    intro: "Une app sur le téléphone de vos clients ou de votre équipe : réservation, carte de fidélité, suivi de chantier, prise de photos sur le terrain…",
    prix: "Sur devis, prix fixe",
    points: [
      { t: "iPhone et Android", d: "Une seule base de code pour les deux, publiée sur les stores." },
      { t: "Reliée à vos données", d: "Les mêmes clients, rendez-vous et factures que dans votre espace Skydev." },
      { t: "Notifications", d: "Rappels, confirmations et messages envoyés au bon moment." },
      { t: "Accompagnement", d: "Publication sur l'App Store et Google Play, puis mises à jour." },
    ],
    faq: COMMON_FAQ,
  },
  {
    slug: "crm-logiciel-gestion",
    nom: "CRM et logiciel de gestion",
    titre: "CRM et logiciel de gestion sur mesure",
    description: "CRM, suivi des clients, devis, factures et planning : la plateforme Skydev dès 29 €/mois, ou un logiciel de gestion développé sur mesure.",
    intro: "Clients, devis, factures, planning, stock : la plateforme Skydev couvre déjà l'essentiel dès 29 € par mois. Pour un besoin très particulier, on l'adapte ou on développe votre propre outil.",
    prix: "Plateforme dès 29 €/mois, sur mesure sur devis",
    points: [
      { t: "Prêt tout de suite", d: "Fichier clients, devis, factures aux mentions belges, ventes, prospection : déjà dans Skydev." },
      { t: "Adapté à vous", d: "Une app manque ? Décrivez-la depuis votre espace, on la construit." },
      { t: "Import de vos données", d: "Clients et produits repris depuis Excel ou votre ancien logiciel." },
      { t: "Une équipe, des droits", d: "Chaque personne voit uniquement ce qui la concerne." },
    ],
    faq: COMMON_FAQ,
  },
  {
    slug: "automatisation-bots",
    nom: "Automatisation et IA",
    titre: "Automatisation, bots et outils IA",
    description: "Automatisez les tâches répétitives : e-mails, relances, saisie, réponses aux clients, outils avec IA. Pour indépendants et PME en Belgique.",
    intro: "Relances, copier-coller entre logiciels, réponses aux mêmes questions : ces tâches peuvent tourner toutes seules et vous rendre des heures chaque semaine.",
    prix: "Sur devis, prix fixe",
    points: [
      { t: "Relances automatiques", d: "Devis sans réponse, factures impayées, rendez-vous à confirmer." },
      { t: "Connexion entre outils", d: "Votre site, votre comptabilité et Skydev se parlent." },
      { t: "Assistants IA", d: "Réponses aux questions fréquentes, tri des demandes, résumés d'appels." },
      { t: "Vous gardez la main", d: "Chaque automatisation est expliquée et peut être coupée à tout moment." },
    ],
    faq: COMMON_FAQ,
  },
  {
    slug: "referencement-local-google",
    nom: "Référencement local Google",
    titre: "Référencement local sur Google",
    description: "Apparaître sur Google et Google Maps dans votre région : fiche d'établissement, avis, site optimisé, annuaires belges.",
    intro: "Quand quelqu'un cherche votre métier près de chez lui, vous devez apparaître : fiche Google soignée, avis, site clair et présence dans les bons annuaires.",
    prix: "Sur devis, prix fixe",
    points: [
      { t: "Fiche Google", d: "Catégories, description, photos, horaires et services bien remplis." },
      { t: "Avis clients", d: "Un lien simple pour les demander, et des réponses aux avis." },
      { t: "Site optimisé", d: "Pages par service et par ville, rapides et bien structurées." },
      { t: "Annuaire Skydev", d: "Votre page sur l'annuaire Skydev, avec réservation en ligne." },
    ],
    faq: COMMON_FAQ,
  },
];

export const customService = (slug: string) => CUSTOM_SERVICES.find((s) => s.slug === slug) ?? null;

/** Villes desservies (pages « Création de site internet à … »). */
export const SERVICE_CITIES = [
  { slug: "wavre", nom: "Wavre" },
  { slug: "ottignies-louvain-la-neuve", nom: "Ottignies-Louvain-la-Neuve" },
  { slug: "rixensart", nom: "Rixensart" },
  { slug: "waterloo", nom: "Waterloo" },
  { slug: "lasne", nom: "Lasne" },
  { slug: "chaumont-gistoux", nom: "Chaumont-Gistoux" },
  { slug: "grez-doiceau", nom: "Grez-Doiceau" },
  { slug: "court-saint-etienne", nom: "Court-Saint-Étienne" },
  { slug: "mont-saint-guibert", nom: "Mont-Saint-Guibert" },
  { slug: "walhain", nom: "Walhain" },
  { slug: "braine-l-alleud", nom: "Braine-l'Alleud" },
  { slug: "nivelles", nom: "Nivelles" },
  { slug: "jodoigne", nom: "Jodoigne" },
  { slug: "bruxelles", nom: "Bruxelles" },
];

export const serviceCity = (slug: string) => SERVICE_CITIES.find((c) => c.slug === slug) ?? null;

/** Anciennes adresses de l'ancien site Skydev → nouvelles pages (301). */
export function legacyRedirect(path: string): string | null {
  const p = path.replace(/\/+$/, "").toLowerCase();
  if (p === "/index.php" || p === "/index.html") return "/";
  if (p === "/brabant-wallon") return "/sur-mesure/creation-site-internet/wavre";
  if (p === "/reservation-en-ligne") return "/logiciel-rendez-vous";
  const m = /^\/creation-site-internet-([a-z-]+)$/.exec(p);
  if (m && serviceCity(m[1]!)) return `/sur-mesure/creation-site-internet/${m[1]}`;
  const slug = p.slice(1);
  if (customService(slug)) return `/sur-mesure/${slug}`;
  return null;
}

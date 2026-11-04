import { appById, type AppId, type SkyApp } from "@/lib/apps";

/**
 * Catalogue public des apps (skydev.be/apps) : textes de présentation, métiers et packs par métier.
 * Les noms, accroches et fonctions viennent de `apps.ts` (une seule source) ; ici seulement ce qui sert au site.
 */

export type StoreApp = {
  id: AppId;
  slug: string;
  /** Titre de la page (Google). */
  titre: string;
  /** Meta description (≤ 160 caractères). */
  description: string;
  /** Paragraphe de présentation. */
  intro: string;
  /** Exemples concrets d'utilisation. */
  usages: string[];
  /** Apps qui vont bien avec. */
  avec: AppId[];
  /** Métiers concernés (étiquettes affichées et recherchables). Rempli depuis `TAGS`. */
  tags: string[];
};

/**
 * Étiquettes « métiers concernés » par app : affichées sur les cartes et la fiche, et utilisées par la recherche
 * du catalogue (« garagiste » trouve Véhicules). Ajouter une étiquette = l'ajouter ici.
 */
const TAGS: Record<AppId, string[]> = {
  rdv: ["Kiné", "Coiffeur", "Esthéticienne", "Ostéopathe", "Coach sportif", "Garagiste", "Psychologue", "Consultant"],
  clients: ["Tous les métiers", "Indépendant", "Commerçant", "Artisan", "Kiné", "Garagiste"],
  site: ["Tous les métiers", "Indépendant", "Restaurant", "Artisan", "Commerçant", "Kiné"],
  factures: ["Tous les métiers", "Artisan", "Consultant", "Freelance", "Garagiste", "Entrepreneur"],
  employes: ["PME", "Commerce avec équipe", "Restaurant", "Garage", "Cabinet"],
  boutique: ["Commerçant", "Boutique", "Créateur", "Producteur local", "Fleuriste", "Caviste"],
  vehicules: ["Garagiste", "Concessionnaire", "Négociant auto", "Vendeur de motos", "Location de véhicules", "Carrossier"],
  "tel-ia": ["Artisan", "Garagiste", "Kiné", "Restaurant", "Plombier", "Indépendant"],
  "sur-mesure": ["Tous les métiers"],
  horaires: ["Restaurant", "Commerce", "Salon de coiffure", "PME", "Boulangerie"],
  conges: ["PME", "Commerce avec équipe", "Restaurant", "Cabinet", "Garage"],
  commandes: ["Restaurant", "Bar", "Snack", "Food truck", "Café", "Hôtel"],
  paie: ["PME", "Restaurant", "Commerce avec équipe", "Employeur"],
  ventes: ["Consultant", "Agence", "Commercial", "Freelance", "Courtier", "Entreprise B2B"],
  projets: ["Entrepreneur", "Agence", "Architecte", "Artisan", "Bureau d'études"],
  interventions: ["Plombier", "Chauffagiste", "Électricien", "Garagiste", "Technicien", "Dépanneur"],
  stock: ["Commerçant", "Garagiste", "Restaurant", "Grossiste", "Pharmacie", "Atelier"],
  caisse: ["Commerçant", "Restaurant", "Salon de coiffure", "Boulangerie", "Marché", "Bar"],
  depenses: ["Tous les métiers", "Indépendant", "Artisan", "Consultant"],
  compta: ["Tous les métiers", "Indépendant", "PME", "Commerçant"],
  marketing: ["Commerçant", "Salon de coiffure", "Restaurant", "Institut de beauté", "Salle de sport"],
  avis: ["Restaurant", "Kiné", "Coiffeur", "Garagiste", "Commerçant", "Artisan"],
  fidelite: ["Café", "Boulangerie", "Salon de coiffure", "Restaurant", "Commerçant", "Institut de beauté"],
  signature: ["Artisan", "Entrepreneur", "Consultant", "Agence", "Courtier"],
  documents: ["Architecte", "Entrepreneur", "Comptable", "Agence", "Cabinet"],
  taches: ["Tous les métiers", "PME", "Agence", "Artisan"],
  messagerie: ["PME", "Commerce avec équipe", "Restaurant", "Équipe terrain"],
  reglages: [],
};

const STORE_BASE: Omit<StoreApp, "tags">[] = [
  { id: "rdv", slug: "rendez-vous", titre: "Prise de rendez-vous en ligne", description: "Agenda en ligne, page de réservation 24 h/24, rappels automatiques, acompte ou carte en garantie. Pour indépendants et PME en Belgique.", intro: "Vos clients voient vos disponibilités et réservent seuls, de jour comme de nuit. Vous recevez le rendez-vous dans votre agenda, le client reçoit une confirmation puis un rappel la veille.", usages: ["Un kiné qui laisse ses patients réserver leurs séances", "Un coiffeur qui réduit les absences avec un acompte", "Un garage qui planifie les entretiens et les contrôles"], avec: ["clients", "avis", "site"] },
  { id: "clients", slug: "fichier-clients", titre: "Fichier clients (CRM)", description: "Fichier clients partagé par toutes vos apps : historique, notes, documents, import Excel. Simple, sécurisé, hébergé en Europe.", intro: "Un seul fichier clients pour toute votre activité : chaque rendez-vous, facture, achat ou message s'ajoute à la fiche du client, sans double encodage.", usages: ["Retrouver l'historique complet d'un client avant de le rappeler", "Importer votre ancien fichier Excel en quelques minutes", "Recevoir les messages de votre site directement dans la fiche"], avec: ["rdv", "factures", "marketing"] },
  { id: "site", slug: "site-web", titre: "Site web relié à vos outils", description: "Votre site internet généré à partir de vos infos, rapide sur mobile, pensé pour Google et relié à vos rendez-vous et à votre boutique.", intro: "Un site propre et rapide, créé à partir de ce que vous avez déjà encodé : prestations, horaires, photos, avis. La réservation et la boutique y sont intégrées.", usages: ["Avoir un site en ligne le jour même, sans développeur", "Mettre votre nom de domaine (option)", "Passer à un site sur mesure plus tard, sans rien perdre"], avec: ["rdv", "boutique", "avis"] },
  { id: "factures", slug: "factures", titre: "Devis et factures", description: "Devis et factures conformes aux règles belges, PDF avec QR de paiement, numérotation automatique et relances. Simple et rapide.", intro: "Créez un devis, faites-le signer en ligne, transformez-le en facture en un clic. Les mentions légales belges, la TVA et la numérotation sont gérées pour vous.", usages: ["Envoyer une facture avec un QR code de paiement", "Relancer automatiquement les factures en retard", "Faire une note de crédit sans refaire la facture"], avec: ["signature", "compta", "depenses"] },
  { id: "employes", slug: "employes", titre: "Employés et accès", description: "Ajoutez vos collaborateurs, donnez-leur les bons accès avec des grades, et reliez-les au planning, aux congés et à la paie.", intro: "Chaque personne de votre équipe a son compte et ne voit que ce qui la concerne. Vous choisissez les droits par grade : accueil, technicien, gérant…", usages: ["Un assistant qui gère l'agenda mais pas la facturation", "Un technicien qui ne voit que ses interventions", "Retirer un accès en un clic quand quelqu'un part"], avec: ["horaires", "conges", "paie"] },
  { id: "boutique", slug: "boutique-en-ligne", titre: "Boutique en ligne", description: "Vendez vos produits en ligne : paiement Bancontact et carte, retrait ou livraison, stock partagé avec votre caisse.", intro: "Vos produits en vente sur internet, avec le même stock que votre magasin. Une vente en ligne ou au comptoir met tout à jour.", usages: ["Vendre en click & collect", "Livrer avec les frais de votre choix", "Suivre les commandes et prévenir le client"], avec: ["stock", "caisse", "site"] },
  { id: "vehicules", slug: "vehicules", titre: "Vitrine de véhicules d'occasion", description: "Encodez vos voitures avec photos, kilométrage, options et Car-Pass. Vitrine en ligne prête pour Google et demandes reçues dans vos messages.", intro: "Chaque voiture a sa fiche complète et sa page en ligne. Quand elle est vendue, elle disparaît de la vitrine (et de votre site s'il est relié à Skydev).", usages: ["Un garage qui publie ses occasions avec 30 photos", "Afficher les voitures sur son propre site via Skydev", "Recevoir les demandes d'essai ou un « Rappelez-moi »"], avec: ["clients", "site", "interventions"] },
  { id: "tel-ia", slug: "telephone-ia", titre: "Réceptionniste IA au téléphone", description: "Une IA décroche quand vous êtes occupé, répond aux questions courantes et vous envoie le résumé de chaque appel.", intro: "Quand vous ne pouvez pas décrocher, une IA répond à votre place, avec vos infos : horaires, adresse, prestations. Vous recevez un résumé de l'appel par email.", usages: ["Ne plus perdre un client parce que vous étiez occupé", "Répondre aux mêmes questions à votre place", "Garder votre numéro actuel"], avec: ["rdv", "clients"] },
  { id: "horaires", slug: "planning", titre: "Planning d'équipe", description: "Les horaires de votre équipe semaine par semaine, export Excel et PDF, synchronisés dans Google Agenda, Apple ou Outlook.", intro: "Faites le planning de la semaine en quelques minutes, par personne ou jour par jour. Chacun le retrouve dans son agenda habituel.", usages: ["Organiser les horaires d'un magasin ou d'un restaurant", "Imprimer le planning pour l'arrière-boutique", "Voir les absences prévues en même temps"], avec: ["conges", "paie", "employes"] },
  { id: "conges", slug: "conges", titre: "Gestion des congés", description: "Demandes de congés en ligne, validation en un clic, soldes par personne et jours fériés belges. Calendrier des absences de l'équipe.", intro: "Vos employés demandent leurs congés en ligne, vous validez en un clic. Les soldes se calculent seuls et les absences apparaissent dans l'agenda et le planning.", usages: ["Fini les congés notés sur un papier", "Voir qui est absent avant d'accepter une demande", "Bloquer l'agenda RDV pendant une fermeture"], avec: ["horaires", "paie", "employes"] },
  { id: "commandes", slug: "commande-a-table", titre: "Commande à table par QR code", description: "Vos clients scannent un QR code, voient la carte avec photos et allergènes, et commandent. La cuisine reçoit la commande en direct.", intro: "Un QR code par table : le client consulte la carte sur son téléphone et commande. La commande arrive en cuisine, et le client suit où elle en est.", usages: ["Un bar ou un restaurant qui gagne du temps au service", "Une carte toujours à jour, avec les allergènes", "Un food truck qui évite la file"], avec: ["caisse", "stock", "fidelite"] },
  { id: "paie", slug: "pre-paie", titre: "Pré-paie pour le secrétariat social", description: "Les prestations du mois, chèques-repas, primes et kilomètres, prêts pour Partena, SD Worx, Securex ou Acerta en un export.", intro: "Les heures viennent du planning, les absences des congés. À la fin du mois, vous exportez tout pour votre secrétariat social, sans recopier.", usages: ["Envoyer les prestations du mois en un fichier", "Ajouter primes et kilomètres au bon endroit", "Avoir un brut indicatif par personne"], avec: ["horaires", "conges", "employes"] },
  { id: "ventes", slug: "prospection-ventes", titre: "Prospection et suivi des ventes", description: "Liste d'appels, pistes en colonnes, relances du jour et devis en un clic. Suivez vos ventes jusqu'à la signature.", intro: "Appelez vos prospects avec un script, notez le résultat en un clic, puis suivez chaque piste jusqu'à la signature. Les relances du jour vous attendent chaque matin.", usages: ["Faire une session d'appels sans tableur", "Ne plus oublier de relancer un devis", "Prévoir le chiffre d'affaires du mois"], avec: ["clients", "factures", "signature"] },
  { id: "projets", slug: "projets", titre: "Projets et chantiers", description: "Projets, chantiers et tâches de l'équipe en colonnes, échéances, temps passé et facturation du temps en un clic.", intro: "Organisez chaque projet en tâches, confiez-les, suivez le temps passé et facturez-le directement.", usages: ["Suivre un chantier étape par étape", "Facturer les heures passées sur un projet", "Voir ce qui est en retard d'un coup d'œil"], avec: ["taches", "factures", "documents"] },
  { id: "interventions", slug: "interventions", titre: "Interventions sur le terrain", description: "Planning des techniciens, bon d'intervention signé sur téléphone, photos avant et après, facture créée en un clic.", intro: "Vos techniciens voient leurs interventions sur leur téléphone, prennent les photos, font signer le client et la facture est prête.", usages: ["Un chauffagiste qui fait signer son bon sur place", "Un garage qui documente une réparation en photos", "Facturer l'intervention le jour même"], avec: ["factures", "clients", "stock"] },
  { id: "stock", slug: "stock", titre: "Gestion de stock", description: "Inventaire, alertes de stock bas, entrées et sorties, scan de code-barres avec le téléphone. Relié à la caisse et à la boutique.", intro: "Vos produits et vos quantités, toujours à jour : chaque vente au comptoir ou en ligne fait baisser le stock, et vous êtes prévenu avant la rupture.", usages: ["Scanner les produits avec la caméra du téléphone", "Recevoir une alerte quand un produit va manquer", "Faire l'inventaire sans papier"], avec: ["caisse", "boutique", "depenses"] },
  { id: "caisse", slug: "caisse", titre: "Caisse enregistreuse", description: "Encaissez sur tablette, téléphone ou ordinateur : espèces ou carte, tickets imprimables, clôture avec rapport Z et stock à jour.", intro: "Une caisse simple pour encaisser au comptoir, sur l'appareil que vous avez déjà. Le stock et la comptabilité suivent tout seuls.", usages: ["Un commerce qui encaisse sur une tablette", "Un marché ou un salon, depuis un téléphone", "Faire la clôture du soir en un clic"], avec: ["stock", "boutique", "compta"] },
  { id: "depenses", slug: "depenses", titre: "Dépenses et tickets d'achat", description: "Photographiez vos tickets et factures d'achat : TVA récupérable calculée, rangement par catégorie, export pour le comptable.", intro: "Prenez le ticket en photo, c'est rangé. La TVA récupérable est calculée et votre comptable reçoit tout d'un coup.", usages: ["Ne plus perdre un ticket de carburant", "Préparer la TVA du trimestre", "Envoyer tout au comptable en un export"], avec: ["compta", "factures"] },
  { id: "compta", slug: "comptabilite", titre: "Comptabilité et TVA", description: "Recettes, caisse et dépenses au même endroit, aide à la déclaration TVA (grilles Intervat), suivi de trésorerie et export comptable.", intro: "Vos recettes et vos dépenses au même endroit, avec les grilles TVA préparées. Vous savez où vous en êtes, et votre comptable aussi.", usages: ["Voir sa trésorerie du mois en un écran", "Préparer la déclaration TVA", "Repérer les factures en retard de paiement"], avec: ["factures", "depenses", "caisse"] },
  { id: "marketing", slug: "emailing", titre: "Campagnes email", description: "Envoyez des emails à vos clients en quelques clics : modèles prêts, prénom automatique, relance des clients perdus, désabonnement conforme.", intro: "Écrivez à vos clients en quelques clics : une promo, une nouveauté, une fermeture. Vous pouvez aussi relancer ceux qui ne sont plus venus depuis longtemps.", usages: ["Annoncer une promotion à tous vos clients", "Faire revenir les clients absents depuis 6 mois", "Prévenir d'une fermeture pour congés"], avec: ["clients", "fidelite", "avis"] },
  { id: "avis", slug: "avis-google", titre: "Avis Google", description: "Demandez un avis Google après chaque rendez-vous, QR code au comptoir, et recevez les remarques privées avant qu'elles deviennent publiques.", intro: "Vos clients contents reçoivent automatiquement un lien pour laisser un avis Google. Les clients mécontents peuvent vous écrire en privé.", usages: ["Monter dans les résultats Google Maps", "Afficher un QR code « Laissez-nous un avis »", "Régler un souci avant un avis négatif"], avec: ["rdv", "site", "fidelite"] },
  { id: "fidelite", slug: "fidelite", titre: "Carte de fidélité et cartes cadeaux", description: "Carte à tampons sur le téléphone du client, QR code à scanner, récompense au choix et cartes cadeaux utilisables en plusieurs fois.", intro: "Une carte à tampons sans papier : le client scanne un QR code et gagne son tampon. Vous vendez aussi des cartes cadeaux, suivies au centime.", usages: ["« Le 10e café offert »", "Vendre des cartes cadeaux pour les fêtes", "Donner un tampon automatique après un rendez-vous"], avec: ["caisse", "marketing", "avis"] },
  { id: "signature", slug: "signature-electronique", titre: "Signature électronique", description: "Faites signer vos devis en ligne, sur téléphone et sans compte, avec une preuve complète. Devis signé, prêt à facturer.", intro: "Envoyez le devis, le client le signe sur son téléphone. Vous savez s'il l'a ouvert, signé ou refusé, et la facture se fait en un clic.", usages: ["Faire signer un devis de travaux le soir même", "Garder une preuve de l'accord", "Arrêter d'imprimer et scanner"], avec: ["factures", "ventes"] },
  { id: "documents", slug: "documents", titre: "Documents partagés", description: "Tous vos fichiers en dossiers, chiffrés sur nos serveurs, partage par lien avec date d'expiration et recherche.", intro: "Les fichiers de votre entreprise rangés au même endroit, accessibles par l'équipe, et partageables avec un client par un simple lien.", usages: ["Partager des plans avec un client", "Ranger les contrats et attestations", "Retrouver un fichier en tapant son nom"], avec: ["projets", "clients"] },
  { id: "taches", slug: "taches", titre: "Tâches et to-do d'équipe", description: "Vos tâches et celles de l'équipe : ajout rapide, listes communes, tâches confiées à un collègue, récurrences.", intro: "Notez une tâche en une ligne, confiez-la à un collègue qui est prévenu, et retrouvez chaque matin ce qu'il y a à faire.", usages: ["« Appeler Marc demain 14h »", "Une check-list d'ouverture du magasin chaque lundi", "Partager les tâches d'un chantier"], avec: ["projets", "messagerie"] },
  { id: "messagerie", slug: "messagerie", titre: "Messagerie d'équipe", description: "Discutez avec votre équipe sans WhatsApp : salons, messages privés, séparé de vos messages personnels.", intro: "Les messages de travail restent au travail : des salons par sujet, des messages privés, et rien qui se mélange avec la vie perso.", usages: ["Un salon par chantier ou par magasin", "Prévenir l'équipe d'un changement", "Garder l'historique quand quelqu'un part"], avec: ["taches", "employes"] },
  { id: "sur-mesure", slug: "sur-mesure", titre: "Fonctions et apps sur mesure", description: "Il vous manque une fonction ? On l'ajoute à votre espace Skydev, ou on construit votre site, votre app ou votre logiciel métier.", intro: "Vous avez une façon de travailler bien à vous ? Décrivez ce qui vous manque : on l'ajoute à votre espace, relié à vos clients et à vos données. Prix fixe annoncé avant de commencer.", usages: ["Un suivi des réparations pour un garage", "Un formulaire d'inscription pour un club", "Un outil interne qui remplace un tableur"], avec: ["clients", "site"] },
];

export const STORE_APPS: StoreApp[] = STORE_BASE.map((a) => ({ ...a, tags: TAGS[a.id] ?? [] }));

/** Texte de recherche d'une app : nom, accroche, étiquettes métiers (sans accents, en minuscules). */
export const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const BY_SLUG = new Map(STORE_APPS.map((s) => [s.slug, s]));
export const storeAppBySlug = (slug: string) => BY_SLUG.get(slug) ?? null;
export const storeAppById = (id: AppId) => STORE_APPS.find((s) => s.id === id)!;
export const storeHref = (id: AppId) => `/apps/${storeAppById(id).slug}`;

/** Apps visibles dans le catalogue public : actives, hors Réglages. */
export function storeApps(): { app: SkyApp; store: StoreApp }[] {
  return STORE_APPS.map((store) => ({ app: appById(store.id), store })).filter(({ app }) => app && app.status === "active" && app.billing !== "system");
}

export type Metier = {
  slug: string;
  nom: string;
  /** « un garage », « un kiné »… */
  un: string;
  titre: string;
  description: string;
  intro: string;
  apps: { id: AppId; pourquoi: string }[];
  /** Idées de fonctions sur mesure pour ce métier. */
  surMesure: string[];
};

export const METIERS: Metier[] = [
  {
    slug: "garage", nom: "Garage", un: "un garage", titre: "Logiciel pour garage",
    description: "Vente de véhicules d'occasion, rendez-vous d'entretien, interventions, devis et factures : tout pour un garage, dans un seul abonnement.",
    intro: "Vos occasions en vitrine, les entretiens réservés en ligne, les réparations documentées et facturées : votre garage dans un seul outil, à partir de 29 € par mois.",
    apps: [
      { id: "vehicules", pourquoi: "Vos occasions en ligne, avec photos, options et Car-Pass." },
      { id: "rdv", pourquoi: "Les clients réservent l'entretien ou le contrôle en ligne." },
      { id: "interventions", pourquoi: "Bon de réparation signé, photos avant et après." },
      { id: "factures", pourquoi: "Devis et factures conformes, avec QR de paiement." },
      { id: "stock", pourquoi: "Pièces et pneus suivis, alerte avant la rupture." },
      { id: "avis", pourquoi: "Plus d'avis Google après chaque passage." },
    ],
    surMesure: ["Suivi de l'état d'une réparation, visible par le client", "Rappel automatique du contrôle technique ou de l'entretien", "Gestion des véhicules de remplacement"],
  },
  {
    slug: "kine", nom: "Kiné et santé", un: "un cabinet de kiné", titre: "Logiciel pour kiné et cabinet de santé",
    description: "Prise de rendez-vous en ligne, rappels, dossiers patients chiffrés, factures et avis : le logiciel simple pour kinés et professions de santé.",
    intro: "Vos patients réservent leurs séances en ligne, reçoivent un rappel la veille, et vous retrouvez leur dossier en un clic. Les données sensibles sont chiffrées.",
    apps: [
      { id: "rdv", pourquoi: "Réservation des séances 24 h/24, rappels contre les absences." },
      { id: "clients", pourquoi: "Dossiers patients avec notes et documents chiffrés." },
      { id: "factures", pourquoi: "Factures en quelques clics, avec QR de paiement." },
      { id: "avis", pourquoi: "Plus d'avis Google pour être trouvé dans votre ville." },
      { id: "site", pourquoi: "Un site de cabinet, avec la réservation intégrée." },
    ],
    surMesure: ["Questionnaire d'anamnèse avant la première séance", "Suivi des séances prescrites", "Planning partagé entre plusieurs praticiens"],
  },
  {
    slug: "coiffure-beaute", nom: "Coiffure et beauté", un: "un salon", titre: "Logiciel pour salon de coiffure et institut de beauté",
    description: "Rendez-vous en ligne, acompte contre les absences, caisse, fidélité et avis Google : tout pour un salon de coiffure ou un institut.",
    intro: "Vos clientes réservent en ligne, un acompte évite les rendez-vous oubliés, et la carte de fidélité les fait revenir. Encaissement et stock suivent tout seuls.",
    apps: [
      { id: "rdv", pourquoi: "Réservation en ligne, acompte ou carte en garantie." },
      { id: "caisse", pourquoi: "Encaissez prestations et produits au comptoir." },
      { id: "fidelite", pourquoi: "Carte à tampons et cartes cadeaux." },
      { id: "stock", pourquoi: "Produits de revente suivis." },
      { id: "avis", pourquoi: "Plus d'avis Google." },
      { id: "marketing", pourquoi: "Promos et rappels par email." },
    ],
    surMesure: ["Fiche technique couleur par cliente", "Réservation de forfaits mariage", "Planning par fauteuil ou par cabine"],
  },
  {
    slug: "restaurant", nom: "Restaurant et bar", un: "un restaurant", titre: "Logiciel pour restaurant, bar et snack",
    description: "Commande à table par QR code, caisse, stock, planning du personnel et fidélité : le logiciel tout-en-un pour l'horeca.",
    intro: "Les clients commandent depuis leur table, la cuisine reçoit tout en direct, et la caisse, le stock et le planning de l'équipe suivent.",
    apps: [
      { id: "commandes", pourquoi: "Commande à table par QR code, carte avec allergènes." },
      { id: "caisse", pourquoi: "Encaissement, tickets et clôture du soir." },
      { id: "stock", pourquoi: "Boissons et ingrédients suivis." },
      { id: "horaires", pourquoi: "Planning de l'équipe de salle et de cuisine." },
      { id: "fidelite", pourquoi: "Carte de fidélité et bons cadeaux." },
    ],
    surMesure: ["Réservation de tables avec plan de salle", "Commandes à emporter avec créneau de retrait", "Fiches techniques et coût des plats"],
  },
  {
    slug: "commerce", nom: "Commerce", un: "un commerce", titre: "Logiciel pour commerce et magasin",
    description: "Caisse, boutique en ligne, stock partagé, fidélité et emails : vendez au comptoir et en ligne avec un seul outil.",
    intro: "Vendez au comptoir et en ligne avec le même stock. Les clients fidèles reviennent grâce à la carte à tampons et à vos emails.",
    apps: [
      { id: "caisse", pourquoi: "Encaissez sur tablette ou téléphone." },
      { id: "boutique", pourquoi: "Click & collect et livraison." },
      { id: "stock", pourquoi: "Un seul stock pour le magasin et le site." },
      { id: "fidelite", pourquoi: "Carte à tampons et cartes cadeaux." },
      { id: "marketing", pourquoi: "Emails à vos clients." },
    ],
    surMesure: ["Réservation d'articles en magasin", "Programme de parrainage", "Connexion à votre fournisseur"],
  },
  {
    slug: "artisan", nom: "Artisan et construction", un: "un artisan", titre: "Logiciel pour artisan et entreprise de construction",
    description: "Devis signés en ligne, chantiers, interventions, factures et dépenses : le logiciel simple pour artisans et entreprises du bâtiment.",
    intro: "Faites signer vos devis le soir même, suivez chaque chantier, et facturez sans repasser par le bureau.",
    apps: [
      { id: "factures", pourquoi: "Devis et factures conformes." },
      { id: "signature", pourquoi: "Devis signé en ligne par le client." },
      { id: "projets", pourquoi: "Chantiers en étapes, temps passé." },
      { id: "interventions", pourquoi: "Bons d'intervention signés sur place." },
      { id: "depenses", pourquoi: "Tickets de matériaux en photo." },
      { id: "documents", pourquoi: "Plans et photos partagés avec le client." },
    ],
    surMesure: ["Métré et calcul de devis automatique", "Suivi des sous-traitants", "Journal de chantier avec photos"],
  },
  {
    slug: "independant-services", nom: "Indépendant et services", un: "un indépendant", titre: "Logiciel pour indépendant et consultant",
    description: "Prospection, devis, factures, rendez-vous et comptabilité : l'outil simple pour indépendants, consultants et freelances en Belgique.",
    intro: "Trouvez des clients, envoyez vos devis, facturez et préparez la TVA, sans jongler entre cinq outils.",
    apps: [
      { id: "ventes", pourquoi: "Prospection et suivi des pistes." },
      { id: "factures", pourquoi: "Devis et factures conformes." },
      { id: "signature", pourquoi: "Devis signés en ligne." },
      { id: "rdv", pourquoi: "Rendez-vous découverte réservés en ligne." },
      { id: "compta", pourquoi: "Trésorerie et TVA au même endroit." },
      { id: "taches", pourquoi: "Ne plus rien oublier." },
    ],
    surMesure: ["Espace client pour partager les livrables", "Suivi du temps par client", "Contrats récurrents facturés automatiquement"],
  },
  {
    slug: "pme-equipe", nom: "PME avec équipe", un: "une PME", titre: "Logiciel de gestion pour PME",
    description: "Planning, congés, pré-paie, tâches, messagerie et accès par grade : gérez votre équipe et votre activité dans un seul outil.",
    intro: "Chaque employé a ses accès, son planning et ses congés. Vous gardez une vue sur tout, et votre secrétariat social reçoit les prestations du mois.",
    apps: [
      { id: "employes", pourquoi: "Comptes et accès par grade." },
      { id: "horaires", pourquoi: "Planning de la semaine." },
      { id: "conges", pourquoi: "Demandes et soldes de congés." },
      { id: "paie", pourquoi: "Export pour le secrétariat social." },
      { id: "taches", pourquoi: "Tâches confiées et suivies." },
      { id: "messagerie", pourquoi: "Messagerie d'équipe sans WhatsApp." },
    ],
    surMesure: ["Pointage des heures sur téléphone", "Tableau de bord sur mesure", "Connexion à vos logiciels existants"],
  },
];

export const metierBySlug = (slug: string) => METIERS.find((m) => m.slug === slug) ?? null;
/** Métiers dans lesquels une app est mise en avant. */
export const metiersOfApp = (id: AppId) => METIERS.filter((m) => m.apps.some((a) => a.id === id));

/** Nombre d'apps présentées (pour les titres) : le même chiffre que l'accueil (Sur mesure compris). */
export const storeCount = () => storeApps().length;

/** Mots du métier saisi à l'inscription → pack métier (le premier qui correspond). */
const METIER_WORDS: [string, string[]][] = [
  ["garage", ["garag", "carross", "mecani", "automobile", "auto ", "moto", "pneu", "concession"]],
  ["kine", ["kine", "physio", "osteo", "infirm", "psy", "medec", "dentist", "logoped", "podolog", "dieteti", "sage-femme", "sante", "therapeut", "chiropr"]],
  ["coiffure-beaute", ["coiff", "barb", "esthet", "beaute", "ongl", "manucur", "massage", "spa", "tatou", "maquill", "institut"]],
  ["restaurant", ["restau", "bar", "cafe", "snack", "traiteur", "brasserie", "friterie", "pizz", "food", "hotel"]],
  ["commerce", ["magasin", "boutique", "commer", "fleur", "librair", "boulang", "patiss", "bouch", "epicer", "pharma", "opticien", "vetement", "caviste"]],
  ["artisan", ["plomb", "electric", "menuis", "chauffag", "peintr", "macon", "couvreur", "carrel", "jardin", "construct", "renov", "toitur", "charpent", "serrur", "vitrier", "parquet", "isolation", "artisan", "batiment"]],
  ["independant-services", ["consult", "freelance", "avocat", "comptab", "agence", "graphi", "develop", "photograph", "coach", "formateur", "architect", "courtier", "assuran", "immobil", "notaire", "traduct"]],
];

/** Pack métier correspondant au métier saisi (« Plombier » → artisan), ou null. */
export function metierForType(businessType: string | null | undefined): Metier | null {
  const t = ` ${fold(businessType ?? "")} `;
  if (!t.trim()) return null;
  const hit = METIER_WORDS.find(([, words]) => words.some((w) => t.includes(w)));
  return hit ? metierBySlug(hit[0]) : null;
}

/** Apps installées d'office pour un métier (sinon les essentiels d'un indépendant). */
export function recommendedApps(businessType: string | null | undefined): AppId[] {
  const m = metierForType(businessType);
  return m ? m.apps.map((a) => a.id) : ["rdv", "factures", "site", "avis", "taches"];
}

/**
 * Mots que les gens tapent pour chaque app (synonymes, verbes, objets), en plus du nom, de l'accroche et des métiers.
 * « vendre voiture » → Véhicules, « payer » → Caisse, « horaire » → Planning.
 */
const KEYWORDS: Partial<Record<AppId, string>> = {
  rdv: "rendez-vous agenda reserver reservation calendrier creneau seance consultation rappel absence acompte prendre",
  clients: "client patient fichier crm contact carnet adresse historique fiche importer excel",
  site: "site internet web page vitrine domaine google referencement en ligne",
  factures: "facture devis facturer note de credit tva paiement payer qr relance impaye encaisser",
  employes: "employe equipe salarie collaborateur acces droit grade utilisateur personnel",
  boutique: "boutique en ligne e-commerce vendre vente produit commande click collect livraison panier shop",
  vehicules: "vehicule voiture auto automobile occasion vendre vente moto camionnette utilitaire annonce garage concession car-pass kilometrage",
  "tel-ia": "telephone appel repondeur ia intelligence artificielle standard secretaire decrocher manque",
  horaires: "planning horaire semaine shift service tournee roulement",
  conges: "conge vacances absence maladie recuperation solde jour ferie",
  commandes: "commande table qr menu carte restaurant cuisine serveur allergene",
  paie: "paie salaire fiche secretariat social prestation cheque-repas prime kilometre",
  ventes: "vente prospect prospection appel pipeline piste commercial relance chiffre affaires signer",
  projets: "projet chantier tache kanban temps passe suivi etape",
  interventions: "intervention technicien depannage reparation terrain bon signature photo chantier entretien",
  stock: "stock inventaire produit piece quantite code-barre reception rupture entrepot",
  caisse: "caisse encaisser payer paiement ticket comptoir vente especes carte terminal z cloture",
  depenses: "depense achat ticket frais note de frais carburant fournisseur recu",
  compta: "comptabilite compta tva tresorerie bilan comptable declaration intervat",
  marketing: "email emailing newsletter campagne promo promotion mailing relancer",
  avis: "avis google note etoile review reputation commentaire",
  fidelite: "fidelite carte tampon point recompense cadeau bon cadeau",
  signature: "signature signer electronique devis contrat accord",
  documents: "document fichier dossier partage pdf stockage cloud drive",
  taches: "tache todo to-do liste rappel oubli checklist",
  messagerie: "message messagerie chat discussion whatsapp equipe",
};

const STOP = new Set(["de", "du", "des", "la", "le", "les", "un", "une", "et", "ou", "a", "au", "aux", "en", "pour", "par", "mes", "mon", "ma", "je", "j", "l", "d", "avec", "sur", "dans", "qui", "que", "faire", "veux", "voudrais", "besoin", "app", "application", "logiciel", "outil"]);

/** Racine d'un mot tapé : « vendre » → « vend », « voitures » → « voitu » (tolère pluriels et conjugaisons). */
const stem = (w: string) => (w.length <= 4 ? w : w.slice(0, Math.max(4, w.length - 2)));

/**
 * Recherche tolérante : chaque mot tapé qui correspond (nom, accroche, métiers, synonymes) rapporte des points ;
 * les apps sont rangées de la plus pertinente à la moins pertinente. Pas besoin que tous les mots correspondent.
 */
export function searchApps<T extends { id: AppId; name: string; tagline: string; tags: string[]; extra?: string }>(items: T[], query: string): T[] {
  const words = fold(query).split(/[^a-z0-9-]+/).filter((w) => w.length >= 2 && !STOP.has(w)).map(stem);
  if (!words.length) return [];
  return items
    .map((a) => {
      const name = fold(a.name);
      const hay = fold([a.tagline, ...a.tags, KEYWORDS[a.id] ?? "", a.extra ?? ""].join(" "));
      const score = words.reduce((s, w) => s + (name.includes(w) ? 3 : 0) + (hay.includes(w) ? 1 : 0), 0);
      return { a, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .map((x) => x.a);
}

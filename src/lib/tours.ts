/**
 * Visites guidées : une bulle pointe un élément réel de la page (sélecteur CSS) et guide le pro
 * pas à pas, y compris d'une page à l'autre. Le moteur est `components/app/guided-tour.tsx`.
 *
 * - `path` : expression régulière du chemin où se trouve l'élément ;
 * - `go` : page à ouvrir si l'utilisateur n'y est pas (absent = il doit cliquer lui-même, ex. une fiche) ;
 * - `target` : sélecteur(s) CSS, le premier trouvé est mis en évidence (absent = bulle centrée) ;
 * - `advanceOnClick` : un clic sur l'élément passe à l'étape suivante (liens qui changent de page).
 */
export type TourStep = { path: string; go?: string; target?: string; title: string; body: string; advanceOnClick?: boolean };
export type Tour = { key: string; icon: string; title: string; desc: string; steps: TourStep[] };

const HOURS = "^/app/horaires$";
const NEW_SERVICE = "^/app/prestations/nouvelle$";
const SAVE = "main form button[type=submit]";

export const TOURS: Tour[] = [
  {
    key: "onboarding",
    icon: "🚀",
    title: "Bien démarrer",
    desc: "Horaires, première prestation et couleurs de votre page, en moins de 5 minutes.",
    steps: [
      { path: HOURS, go: "/app/horaires", target: "main [role=switch]", title: "Activez vos jours d'ouverture", body: "Chaque interrupteur ouvre ou ferme un jour de la semaine. Les clients ne peuvent réserver que pendant vos heures d'ouverture." },
      { path: HOURS, go: "/app/horaires", target: "main input[type=time]", title: "Réglez les horaires", body: "Indiquez l'heure de début et de fin. Ajoutez une deuxième plage pour une pause de midi, puis enregistrez." },
      { path: NEW_SERVICE, go: "/app/prestations/nouvelle", target: "#name", title: "Ajoutez votre première prestation", body: "Donnez-lui le nom que vos clients connaissent : « Séance de kiné », « Coupe homme »…" },
      { path: NEW_SERVICE, go: "/app/prestations/nouvelle", target: "#durationMin", title: "Durée et prix", body: "La durée bloque le bon créneau dans votre agenda. Le prix est facultatif." },
      { path: NEW_SERVICE, go: "/app/prestations/nouvelle", target: SAVE, title: "Enregistrez", body: "Elle apparaît tout de suite sur votre page de réservation." },
      { path: "^/app/page-de-reservation/apparence$", go: "/app/page-de-reservation/apparence", target: "main input[type=color]", title: "Personnalisez votre couleur", body: "Choisissez la couleur de votre marque : l'aperçu se met à jour en direct. Votre page est prête à être partagée !" },
    ],
  },
  {
    key: "service",
    icon: "🏷️",
    title: "Créer une prestation",
    desc: "Ajouter une prestation (nom, prix, durée, couleur), étape par étape.",
    steps: [
      { path: "^/app/prestations$", go: "/app/prestations", target: "[data-tour=new-service]", title: "Créez une prestation", body: "Tout commence ici : cliquez sur « Nouvelle prestation ».", advanceOnClick: true },
      { path: NEW_SERVICE, go: "/app/prestations/nouvelle", target: "#name", title: "Nom de la prestation", body: "C'est ce que verront vos clients sur votre page." },
      { path: NEW_SERVICE, go: "/app/prestations/nouvelle", target: "#durationMin", title: "Durée", body: "Le temps bloqué dans l'agenda. Cochez « durée variable » si elle dépend du client." },
      { path: NEW_SERVICE, go: "/app/prestations/nouvelle", target: "#price", title: "Prix", body: "Facultatif : laissez vide pour ne pas afficher de prix." },
      { path: NEW_SERVICE, go: "/app/prestations/nouvelle", target: "[data-tour=service-color]", title: "Couleur dans l'agenda", body: "Pour reconnaître la prestation d'un coup d'œil dans votre agenda." },
      { path: NEW_SERVICE, go: "/app/prestations/nouvelle", target: SAVE, title: "Enregistrez", body: "C'est en ligne !" },
    ],
  },
  {
    key: "groupSessions",
    icon: "🧘",
    title: "Créer un cours collectif",
    desc: "Une séance à plusieurs participants (yoga, atelier, cours de groupe).",
    steps: [
      { path: NEW_SERVICE, go: "/app/prestations/nouvelle", target: "#name", title: "Nom du cours", body: "Par exemple « Pilates débutant »." },
      { path: NEW_SERVICE, go: "/app/prestations/nouvelle", target: "input[name=kind][value=group]", title: "Choisissez « Cours collectif »", body: "Plusieurs clients pourront réserver la même séance." },
      { path: NEW_SERVICE, go: "/app/prestations/nouvelle", target: "#capacity, input[name=kind][value=group]", title: "Nombre de places", body: "Quand la séance est complète, elle n'est plus réservable (ou passe en liste d'attente si vous l'activez)." },
      { path: NEW_SERVICE, go: "/app/prestations/nouvelle", target: SAVE, title: "Enregistrez, puis planifiez", body: "Après l'enregistrement, ouvrez la prestation pour ajouter les séances : ponctuelles ou récurrentes chaque semaine." },
    ],
  },
  {
    key: "editServiceTargeting",
    icon: "🎯",
    title: "Proposer une prestation selon la réponse",
    desc: "Poser une question avant la réservation et n'afficher que les prestations adaptées.",
    steps: [
      { path: "^/app/prestations/questions$", go: "/app/prestations/questions", target: "[data-tour=new-intake]", title: "Une question avant la réservation", body: "Ex. « Est-ce votre première visite ? » ou « Êtes-vous enceinte ? ». Chaque réponse peut afficher ou masquer des prestations." },
      { path: "^/app/prestations/questions$", go: "/app/prestations/questions", title: "Choisissez les prestations par réponse", body: "Pour chaque réponse possible, cochez les prestations à proposer. Le client ne verra que celles qui lui correspondent." },
    ],
  },
  {
    key: "clientView",
    icon: "👤",
    title: "Voir la fiche d'un client",
    desc: "Toutes les infos d'un client : aperçu, rendez-vous et dossier de suivi.",
    steps: [
      { path: "^/app/clients$", go: "/app/clients", target: "main input[name=q]", title: "Retrouvez un client", body: "Cherchez par nom, email ou téléphone." },
      { path: "^/app/clients$", go: "/app/clients", target: "main table a[href^='/app/clients/']", title: "Ouvrez sa fiche", body: "Cliquez sur le nom d'un client.", advanceOnClick: true },
      { path: "^/app/clients/[^/]+$", target: "[data-tour=customer-tabs]", title: "Toutes ses informations", body: "Aperçu, historique des rendez-vous et dossier de suivi, chacun dans son onglet." },
      { path: "^/app/clients/[^/]+$", target: "[data-tour=customer-general], [data-tour=customer-tabs]", title: "Notes générales", body: "Allergies, préférences… visibles en haut de la fiche à chaque visite." },
    ],
  },
  {
    key: "clientNote",
    icon: "📝",
    title: "Écrire dans un dossier client",
    desc: "Ajouter une note de suivi datée (constat, à faire, PDF).",
    steps: [
      { path: "^/app/clients$", go: "/app/clients", target: "main table a[href^='/app/clients/']", title: "Ouvrez la fiche d'un client", body: "Cliquez sur le nom d'un client.", advanceOnClick: true },
      { path: "^/app/clients/[^/]+$", target: "[data-tour=customer-tabs] a[href$='onglet=dossier']", title: "Onglet « Dossier »", body: "Le dossier de suivi est chiffré et visible uniquement par l'équipe autorisée.", advanceOnClick: true },
      { path: "^/app/clients/[^/]+$", target: "[data-tour=new-note]", title: "Ajoutez une note de suivi", body: "Date, constat, ce qu'il faudra faire au prochain rendez-vous, et un PDF si besoin." },
    ],
  },
  {
    key: "daysOff",
    icon: "🌴",
    title: "Ajouter un congé",
    desc: "Bloquer une date ou une période pour ne plus recevoir de réservations.",
    steps: [
      { path: HOURS, go: "/app/horaires", target: "[data-tour=exceptions]", title: "Congés et fermetures", body: "Vacances, jour férié, formation ou horaires exceptionnels : tout se gère ici." },
      { path: HOURS, go: "/app/horaires", target: "#ex-from", title: "Choisissez les dates", body: "Un seul jour, ou une période en remplissant aussi « Au »." },
      { path: HOURS, go: "/app/horaires", target: "#ex-type", title: "Fermé, ou ouvert autrement ?", body: "Fermeture complète, ou horaires différents ce jour-là." },
      { path: HOURS, go: "/app/horaires", target: "[data-tour=exceptions] button[type=submit]", title: "Validez", body: "Les créneaux disparaissent aussitôt de votre page de réservation." },
    ],
  },
  {
    key: "availability",
    icon: "🕒",
    title: "Mes disponibilités",
    desc: "Activer vos jours d'ouverture et régler vos horaires.",
    steps: [
      { path: HOURS, go: "/app/horaires", target: "main [role=switch]", title: "Activez vos jours d'ouverture", body: "Un interrupteur par jour." },
      { path: HOURS, go: "/app/horaires", target: "main input[type=time]", title: "Réglez les horaires", body: "Ajoutez plusieurs plages pour une pause, copiez un jour sur toute la semaine, puis enregistrez." },
    ],
  },
  {
    key: "settings",
    icon: "⚙️",
    title: "Modifier mon profil",
    desc: "Changer votre nom, votre photo et vos informations de compte.",
    steps: [
      { path: "^/app/compte$", go: "/app/compte", target: "#pf-name", title: "Votre profil personnel", body: "Nom, téléphone et photo : ils servent à votre équipe et sur votre profil public." },
      { path: "^/app/compte$", go: "/app/compte", target: SAVE, title: "Enregistrez", body: "Sur la même page : email, mot de passe et double authentification." },
    ],
  },
  {
    key: "collaborators",
    icon: "🤝",
    title: "Inviter un collaborateur",
    desc: "Ajouter un membre à votre équipe et lui attribuer un grade.",
    steps: [
      { path: "^/app/equipe$", go: "/app/equipe", target: "[data-tour=add-member]", title: "Ajoutez un membre", body: "Cliquez sur « Ajouter un membre ».", advanceOnClick: true },
      { path: "^/app/equipe/ajouter$", go: "/app/equipe/ajouter", target: "#email", title: "Son adresse email", body: "Il reçoit une invitation et rejoint l'équipe avec son propre compte." },
      { path: "^/app/equipe/ajouter$", go: "/app/equipe/ajouter", target: "#gradeId", title: "Choisissez son grade", body: "Le grade définit ce qu'il peut voir et faire (agenda, clients, réglages…)." },
      { path: "^/app/equipe/ajouter$", go: "/app/equipe/ajouter", target: SAVE, title: "Envoyez l'invitation", body: "Il apparaît dans l'équipe dès qu'il accepte." },
    ],
  },
  {
    key: "questionnaire",
    icon: "📋",
    title: "Créer un questionnaire",
    desc: "Poser des questions à vos clients avant qu'ils confirment leur réservation.",
    steps: [
      { path: "^/app/page-de-reservation$", go: "/app/page-de-reservation", target: "[data-tour=form-questions]", title: "Ajoutez une question", body: "Texte libre, choix, case à cocher… Les réponses sont jointes au rendez-vous." },
      { path: "^/app/page-de-reservation$", go: "/app/page-de-reservation", target: "[data-tour=form-questions]", title: "Libellé et réponses", body: "Rédigez la question, indiquez si elle est obligatoire, puis enregistrez. Vous pouvez en changer l'ordre à tout moment." },
    ],
  },
  {
    key: "cancellationPolicy",
    icon: "🛡️",
    title: "Politique d'annulation",
    desc: "Configurer une retenue automatique en cas d'annulation tardive ou d'absence.",
    steps: [
      { path: "^/app/reglages/paiements$", go: "/app/reglages/paiements", target: "input[name=cancellationRule]", title: "Choisissez votre règle", body: "Annulation libre, 50 % retenus si annulation à moins de 24 h, ou 100 % à moins de 12 h." },
      { path: "^/app/reglages/paiements$", go: "/app/reglages/paiements", target: SAVE, title: "Enregistrez", body: "Une carte est alors demandée en garantie à la réservation (rien n'est prélevé tant qu'il n'y a pas d'annulation tardive ou d'absence)." },
    ],
  },
];

export const tourByKey = (key: string) => TOURS.find((t) => t.key === key);

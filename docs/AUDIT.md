# Audit de parité — ancien Branshee → v2

Comparaison écran par écran et route par route de l'ancien code (`chewie-ui/saas-rdv` : 14 fichiers de routes,
~20 000 lignes de contrôleurs, ~28 000 lignes de vues, ~23 000 lignes de JS client) avec la v2.
Objectif : **toutes** les fonctionnalités de l'ancien Branshee existent dans la v2, en plus propre.

Légende : ✅ fait · 🔶 partiel · ❌ manquant · ➕ nouveau en v2 (n'existait pas)

Les lots sont traités dans l'ordre ; chaque lot fini = un commit sur GitHub.

---

## Lot A — Agenda et rendez-vous ✅
- ✅ Vue semaine (une colonne par membre, filtre par membre) · vue mois · densité confortable / compacte
- ✅ Clic sur la grille → « Rendez-vous » ou « Bloquer ce créneau » pré-remplis (heure au quart d'heure, membre de la colonne)
- ✅ Nouveau RDV : recherche du client, nouveau client (prénom / nom), prestation facultative, membre « le premier disponible », durée libre, saisie rapide d'heure (« 9 », « 0930 », « 14h30 »), plusieurs dates d'un coup
- ✅ Bloquer un créneau : membre ou tout l'établissement, commentaire ; modifier / supprimer
- ✅ Modifier un RDV : date, heure, durée, membre, conflits détectés, **mot au client** dans l'email « rendez-vous déplacé »
- ✅ Annuler / restaurer, rappel manuel, paiement noté à la main, compte client lié affiché
- ✅ Demandes : refus avec motif envoyé au client, demandes expirées à libérer (une par une ou toutes), page « Demandes » dans le menu dès qu'il y en a
- ✅ Historique : recherche, statut, période, membre, pagination, sélection multiple + suppression
- ✅ Tableau de bord : stats avec évolution, prochains RDV, dernières réservations, activité récente, checklist « Bien démarrer »
- ✅ Vocabulaire « patients » pour les métiers de santé (menu, tableau de bord, formulaires)
- ⏳ Encaisser la pénalité d'une absence non excusée → lot H (paiements) · événements Google Agenda → lot L

## Lot B — Clients (CRM) ✅
- ✅ Liste : recherche (y compris contacts alternatifs), filtres période (RDV à venir, venus ces 7 / 30 / 90 jours) et statut (dernier RDV confirmé / annulé, absences, bloqués), colonnes téléphone, praticien, nombre de RDV, dernier RDV, statut ; sélection multiple + suppression
- ✅ Ajouter une fiche à la main (le nom suffit)
- ✅ Fiche à onglets Aperçu / Rendez-vous / Dossier ; résumé (terminés, annulés, absences, encaissé), prochain RDV, appeler / SMS / email / nouveau RDV en un clic
- ✅ Coordonnées (prénom, nom, email, téléphone), contacts alternatifs (autre nom, email, téléphone), notes générales chiffrées
- ✅ Dossier : notes datées chiffrées, **PDF joint** (chiffré sur le disque, ouvrir / télécharger, réservé à l'équipe), recherche dans les notes ; les PDF de l'ancien Branshee restent lisibles
- ✅ Onglet Rendez-vous : recherche, filtres année / prestation / praticien, rattacher un RDV à une autre fiche
- ✅ Fusionner deux fiches (RDV, notes, coordonnées, notes générales), bloquer / débloquer, supprimer (avec dossier et RDV)
- ✅ Vocabulaire « patients » / « clients » selon le métier

## Lot C — Prestations et cours collectifs ✅
- ✅ Nom, description, prix, durée, couleur, catégorie, membres, actif, public selon « première visite »
- ✅ **Durée en fourchette** (« 30 à 45 min ») : affichée au client, l'agenda bloque la durée maximale
- ✅ Image de la prestation (affichée dans la liste et sur la page de réservation)
- ✅ Frais d'annulation propres à la prestation (% ou montant) — appliqués avec les paiements (lot H)
- ✅ Lieu propre à la prestation (affiché au client)
- ✅ Catégories : icône emoji, renommer, supprimer, réordonner ; style public pastilles / accordéon / liste groupée
- ✅ Liste : recherche, tri (nom, prix, durée), filtres (type, statut), colonnes masquables (mémorisées), monter / descendre, activer / masquer en un clic, sélection multiple
- ✅ Questionnaire d'orientation (➕ jours et heures par prestation)
- ✅ Cours collectifs : **cours récurrent sans fin** (jours + heure, séances calculées à la volée et enregistrées à la première inscription), dates ponctuelles avec heure de fin libre (répétables N semaines), annuler / rétablir une séance (récurrente comprise), animateur par séance ou membres assignés au cours, « bloque tout le monde » si personne n'est assigné
- ✅ Migration : les inscriptions aux cours récurrents de l'ancien Branshee retrouvent leur séance
- ⏳ Limites du forfait (5 prestations en gratuit…) → lot J

## Lot D — Disponibilités et règles ✅
- ✅ Horaires communs / par membre, plusieurs plages, congés et horaires spéciaux, droit de poser ses congés
- ✅ Congés pour tout l'établissement, un membre ou **plusieurs membres à la fois**, sur une période (du… au…)
- ✅ Durée / intervalle, battements avant / après, délai minimum (liste ou **personnalisé en heures**), horizon (liste ou **personnalisé en jours**), confirmation auto, téléphone obligatoire
- ✅ Surréservation : réglage dans Réglages › Réservation (RDV créés par le pro)
- ✅ **Regroupement intelligent** (fenêtre 1–6 h, jours concernés) : créneaux proches d'un RDV mis en avant (étoile « créneau conseillé ») sur la page publique
- ✅ Liste d'attente branchée pour de bon : jour complet → le client laisse son email ; annulation / refus → email `waitlist_spot`, chaque inscrit prévenu une seule fois
- ✅ Durée sans prestation : la réservation en ligne passe toujours par une prestation ; un RDV manuel sans prestation prend la durée saisie
- ✅ Résumé sur la page Horaires : jours ouverts, heures / semaine, créneaux théoriques + lien « Voir comme un client »

## Lot E — Page de réservation (personnalisation) ✅
Trois onglets dans « Page de réservation » : **Contenu**, **Apparence**, **Partager et intégrer**.
- ✅ Profil : photo / logo, « À propos » en texte riche (gras, italique, souligné, listes, 3 tailles) — HTML nettoyé par liste blanche à l'enregistrement et à l'affichage (les anciens textes importés aussi)
- ✅ Localisation : sur place / en ligne / carte personnalisée, adresse, pays, lien « Ouvrir dans Maps », code de carte Google Maps (seule une URL `google.com/maps/embed` est gardée), langues parlées, carte automatique depuis l'adresse
- ✅ Galerie photos (12 max, grille / mosaïque / carrousel, réordonner, retirer)
- ✅ Ordre et visibilité des sections : à propos, localisation, horaires, galerie, avis, équipe, FAQ
- ✅ Contact et réseaux (site, Instagram, Facebook, WhatsApp, TikTok, LinkedIn, YouTube) avec visibilité par réseau, email et téléphone compris
- 🔶 URL personnalisée : modifiable ✅ · le verrou payant (option 5 €/mois ou formule Business) arrive avec le Lot J (formules)
- ✅ Emails : délai du rappel, message du rappel, modes de paiement + précision rappelés dans l'email, aperçu (Réglages › Notifications)
- ✅ Apparence : 7 thèmes prêts à l'emploi, 13 couleurs (accent, fond, cartes, texte, jours, sélection, survols, pastilles de disponibilité), image de fond, textes (aide au-dessus du calendrier, titre de l'étape créneau, fuseau affiché), 10 polices + police importée, arrondis, bordures, ombres, disposition, annuler / rétablir (Ctrl+Z / Ctrl+Y), réinitialiser, **aperçu en direct** ordinateur / mobile
- ✅ Partager et intégrer : lien, adresse personnalisée, QR code téléchargeable, 4 formats (calendrier dans la page, bouton, bulle flottante, lien), consignes pour 8 plateformes, hauteur fixe sans JavaScript, sections affichées, titre / police / dimensions
- ✅ Compatibilité : `/js/embed.js`, `?sections=` et le message `branshee-resize` de l'ancien Branshee sont repris tels quels — les codes déjà collés sur les sites des pros continuent de fonctionner
- ✅ Sécurité : l'espace pro, l'admin et la connexion refusent d'être affichés dans le cadre d'un autre site (anti-clickjacking) ; la page publique reste intégrable
- ✅ Questions avant réservation, FAQ

## Lot F — Réservation en ligne (client) ✅ (sauf paiement → Lot H)
- ✅ Tunnel prestation → praticien → jour / créneau → coordonnées, revérification serveur, anti-robots
- ✅ Questionnaire, première visite, cours collectifs, styles de catégories, créneaux regroupés
- 🔶 Paiement en ligne (Stripe), prépaiement, empreinte de carte : avec Stripe Connect (Lot H)
- ✅ Connexion dans le tunnel (coordonnées pré-remplies, fiche rattachée au compte), incitation à créer un compte après la réservation
- ✅ Ajout à l'agenda : Google, Apple (.ics), Outlook, autre
- ✅ **Déplacer** son RDV soi-même (même prestation et praticien, règles en ligne, revérifié à la validation, l'ancien créneau n'est jamais libéré entre-temps) + email au client et au pro
- ✅ Avis : note + commentaire (compte vérifié, un par établissement, pas sur le sien), moyenne, signalement par tous (5 motifs, une fois par personne), demande de suppression par le pro (onglet « Avis »), décision par l'équipe Branshee (Lot N)
- ✅ Page établissement : « ouvert aujourd'hui » (avec fermetures exceptionnelles), copier email / téléphone, visionneuse de la galerie, « voir plus »
- ✅ Page « établissement en pause » dédiée, application installable (manifeste, icônes, service worker sans cache de données)

## Lot G — Espace client ✅
- ✅ `/espace-client` : RDV à venir (déplacer, annuler, ajouter à l'agenda, adresse + itinéraire, statut « en attente »), historique (laisser un avis, reprendre RDV), mes avis (supprimer)
- ✅ Paramètres : photo, nom, téléphone, civilité, date de naissance, adresse, emails d'information, changement d'email avec code, mot de passe, langue, suppression du compte avec code — 🔶 cartes enregistrées avec Stripe (Lot H)
- ✅ Rattachement automatique des anciens RDV par email **uniquement après vérification de l'adresse** (code à 6 chiffres) — l'ancien rattachait sans vérifier, ce qui permettait de lire les RDV de quelqu'un d'autre
- ✅ Inscription client depuis une page de réservation, connexion qui renvoie vers la bonne page (pro → `/app`, client → `/espace-client`)

## Lot H — Paramètres du compte pro et paiements
- ✅ Profil : nom, photo, téléphone avec indicatif, changement d'email avec code (Mon compte)
- ✅ Sécurité : changer le mot de passe (déconnecte les autres appareils), double authentification TOTP (QR code, secrets de l'ancien Branshee repris et chiffrés)
- ✅ Langue (enregistrée ; traduction de l'interface au Lot R), notification « nouvelle réservation » dans Réglages
- ✅ Supprimer son compte avec code (établissements fermés, compte anonymisé s'il en possédait) · 🔶 pause / suppression d'un établissement : Lot I
- ✅ **Stripe Connect** Express (connexion, retour vérifié sur Stripe, lien expiré → nouveau lien, compte existant saisi à la main et vérifié, déconnexion) — Réglages › Paiements
- ✅ Prépaiement (au choix ou obligatoire), paiement Stripe Elements (carte, Apple / Google Pay), montant toujours lu en base, paiement vérifié côté serveur, un paiement = une réservation, remboursement automatique si le créneau est pris entre-temps
- ✅ Politique d'annulation (gratuite / 50 % sous 24 h / 50 % sous 24 h + 100 % sous 12 h), frais propres à la prestation, carte en garantie (0 € prélevé) pour ceux qui paient sur place, frais affichés avant d'annuler, prélèvement ou remboursement partiel automatique, décision rembourser / garder par le pro, absence non excusée facturable, annulation par le pro = remboursement complet
- ✅ Modes acceptés sur place : espèces, carte, virement (IBAN, BIC, banque, note), PayPal.me (lien avec le montant), QR code (image + note) — affichés au client après la réservation
- ✅ Moyen de reversement (virement, PayPal, espèces, autre) quand Branshee encaisse pour le pro
- ℹ️ Sans clés Stripe sur le serveur, le paiement en ligne est simplement masqué (testé) ; le parcours Stripe réel est à tester avec les clés de test sur le VPS

## Lot I — Établissements et équipe ✅ (sièges payants → Lot J)
- ✅ Plusieurs établissements, sélecteur, membres, invitations par email, grades, profil public des membres
- ✅ Page « Mes établissements » : voir la page, mettre en pause / réactiver, supprimer (en retapant le nom), quitter un établissement · 🔶 forfait de chacun : Lot J
- ✅ Rejoindre un établissement (recherche par nom ou ville + demande, email au propriétaire), accepter / refuser les demandes (page Équipe), invitations reçues à accepter / refuser (email d'invitation, visible sur Bienvenue et Mes établissements)
- ✅ Propriétaire réservable ou non (case « Réservable par les clients » sur sa fiche)
- ✅ Infos complémentaires (libellé / valeur) et présentation sur le profil public d'un membre
- ✅ Sièges collaborateurs supplémentaires (10 €/mois) : fait au lot J

## Lot J — Abonnements (Branshee → pro) ✅
- ✅ Forfaits **par établissement** : Amateur (gratuit), Pro (19 € ou 15 €/mois à l'année), Pro+ (49 € ou 39 €) — l'ancien abonnement « compte » reste lu tant qu'il existe
- ✅ Limites appliquées partout : prestations actives (5), collaborateurs (0 / 2 / 10 + sièges), questions du formulaire (1 / 5 / 10), confirmation automatique jusqu'à 20 RDV/mois en gratuit (ensuite « à confirmer », rien n'est bloqué), rappels automatiques, personnalisation de la page, réseaux sociaux, battements et durée des créneaux, grades et journal (Pro+), URL personnalisée (Pro+ ou option), sans mention Branshee (Pro+), création d'établissements (1 gratuit + 1 par Pro+)
- ✅ Historique limité à 7 jours en gratuit **sans rien supprimer** (l'ancien effaçait les RDV de plus de 7 jours : perte de données patients)
- ✅ Passage à un forfait inférieur : prestations / collaborateurs / questions en trop désactivés, jamais supprimés
- ✅ Paiement Stripe Checkout, changement d'offre au prorata, résiliation à l'échéance, reprise, portail Stripe (cartes, factures PDF, adresse de facturation, n° de TVA), webhook signé, retour vérifié auprès de Stripe
- ✅ Options dans le même abonnement : URL personnalisée (5 €/mois), sièges collaborateurs (10 €/mois l'unité)
- ✅ Codes promo (essai gratuit, %, montant ; forfait visé ; usage unique par compte ; annuel + % = un mois de remise), campagne avec compte à rebours (premier mois à prix cassé, une fois par compte), liens d'accès offerts (`/acces/<code>`)
- ✅ Parrainage : code et lien personnels, filleuls listés, 3 abonnés = 2 mois offerts (coupon sur l'abonnement)
- ✅ Accès offert par le super-admin, désormais par établissement
- ℹ️ Sans clés Stripe, les forfaits s'affichent mais le paiement est désactivé (testé) ; à tester avec les clés de test sur le VPS

## Lot K — SMS et WhatsApp ✅
- ✅ Rappel (remplace l'email) et confirmation (en plus de l'email) par SMS — Spryng, comme l'ancien
- ✅ Quota inclus par forfait (Pro 10, Pro+ 30 / mois), réservé de façon atomique ; au-delà : solde prépayé si « continuer au-delà du forfait » est activé (SMS 0,30 €, WhatsApp 0,05 €), remboursé si l'envoi échoue ; sinon repli email
- ✅ Recharge du solde (10 / 20 / 50 €, Stripe Checkout, crédité une seule fois même si retour + webhook), recharge automatique sous un seuil (carte enregistrée), alerte « solde bas » puis « épuisé » dans l'espace pro, compteur mensuel
- ✅ WhatsApp (modèles Meta « rdv_rappel » et « rdv_confirmation ») prioritaire, repli SMS puis email ; même quota et même solde
- ✅ Interrupteur global `sms_notifications` (super-admin)
- ℹ️ Sans jetons Spryng / Meta, rien ne part et l'email prend le relais (testé, facturation testée en base)

## Lot L — Intégrations ✅
- ✅ Google Agenda (forfait Pro) : connexion OAuth, RDV envoyés / mis à jour / supprimés automatiquement (création, confirmation, report, annulation, restauration), RDV à venir envoyés à la connexion, événements personnels Google qui bloquent les créneaux, déconnexion avec révocation — connexions de l'ancien reprises
- ✅ Flux iCal personnel (même adresse `/ical/<jeton>` que l'ancien) : propriétaire = tout l'établissement, collaborateur = ses RDV ; nom + prestation uniquement ; régénérer le lien
- ✅ Connexion avec Google (pro et client) : compte relié par adresse vérifiée, création de compte, double authentification respectée, invitations et RDV rattachés
- ℹ️ Sans identifiants Google, les boutons sont masqués (testé) ; parcours Google à tester sur le VPS

## Lot M — Aide, support, accompagnement
- ✅ Centre d'aide `/app/aide` : recherche, chapitres, sections vidéos + FAQ (contenu de l'éditeur super-admin, HTML nettoyé ; contenu par défaut sinon), contacts email / WhatsApp (`SUPPORT_EMAIL`, `SUPPORT_WHATSAPP`)
- ✅ 12 visites guidées (moteur `components/app/guided-tour.tsx`, définitions `lib/tours.ts`) : mise en évidence de l'élément réel, navigation entre pages, passage au clic, dépliage des formulaires, Échap pour quitter
- ✅ Chat de support (rafraîchi toutes les 10 s, badge non lu dans le menu, email à `SUPPORT_EMAIL`), clôture par l'équipe → note 1 à 5 (`support_ratings`), un nouveau message rouvre
- ✅ Messages de l'équipe Branshee en bannière dans l'espace pro (pour tous ou un compte, 60 jours, fermeture mémorisée)
- ✅ Écran de bienvenue après création de l'établissement → visite « Bien démarrer » ; checklist « Bien démarrer » (déjà là)
- ✅ Migration : notes de satisfaction et contenu du centre d'aide repris
- ➡️ Emails de relance (J+1, J+3, « créez votre établissement ») : lot Q (crons)
- ➡️ Côté équipe (répondre, clôturer, éditer l'aide, écrire aux pros) : lot N

## Lot N — Super-admin
- ✅ Navigation en barre latérale groupée, badges (support non lu, avis signalés, métiers à trancher)
- ✅ Établissements : recherche, fiche, pause, forfait offert / essai par établissement, correction des infos (nom, adresse, métier, coordonnées), suppression (confirmation par saisie du nom), export CSV
- ✅ Utilisateurs : fiche (établissements, parrainage, support), désactivation, suppression (confirmation par l'email), export CSV
- ✅ Supervision : demande → le pro accepte/refuse dans son espace → session de 2 h au plus, bandeau des deux côtés, inscrite au journal, le pro peut y mettre fin ; réglages de sécurité du compte bloqués pendant la session
- ⚠️ Mode « connexion discrète » de l'ancien (sans accord du pro) volontairement non repris : données de santé (RGPD)
- ✅ Journal global (recherche, pagination), acquisition (visiteurs, sources UTM, campagnes, pages, inscriptions — la collecte des vues arrive au lot O), parrainages, métiers (demandés + utilisés hors liste ; valider / bloquer), mise en avant (position)
- ✅ Codes promo (%, montant, essai ; limites, expiration, forfait), « offre affichée » sur la page Abonnement, campagne à compte à rebours, liens d'accès (copie, activation, suppression)
- ✅ Interrupteurs : pages en maintenance / erreur / désactivées (connexion, inscription, pages de réservation, espace pro, abonnement ; accueil et annuaire au lot O), cours collectifs, temps de battement, SMS (éteint par défaut comme l'ancien), masquage des liens du menu
- ✅ Support (conversations, réponse + email au pro, clôture → note, suppression, satisfaction moyenne), messages aux pros (tous ou liste d'emails), avis signalés (supprimer / conserver), éditeur du centre d'aide (sections, vidéos, FAQ en texte riche, ordre), blog (éditeur riche, images, couverture, brouillon / programmé / publié, SEO, duplication)
- ✅ Liste officielle des 144 métiers reprise (`lib/professions.ts`)

## Lot O — Site public Branshee (marketing) ✅
- ✅ Accueil (accroche, comparatif, « six outils en un », fonctionnalités, tout inclus, comment ça marche, transparence, tarifs, métiers, établissements mis en avant, FAQ avec balisage Google, appel final), en-tête et pied de page, menu mobile
- ✅ Tarifs (forfaits mensuel / annuel tirés des vraies limites, tableau comparatif, FAQ), contact (formulaire avec anti-robots et limitation, email à `SUPPORT_EMAIL`), confidentialité et CGU reprises et mises à jour (sous-traitance des données de santé, cookies réels)
- ✅ Annuaire `/annuaire` : recherche métier / nom, ville ou code postal, puces de métiers, filtre « 4,5 et plus », ordre mis en avant → forfait → note, pagination
- ✅ 80 pages SEO métier × ville `/logiciel-rendez-vous/…` (textes de l'ancien) + page index, avec les établissements réels de la ville
- ✅ Blog public (catégories, pagination, article avec encart d'inscription, « à lire aussi », compteur de vues, balisage BlogPosting), flux RSS, sitemap.xml (pages, SEO, articles, établissements actifs), robots.txt, IndexNow (même clé que l'ancien) à la publication
- ✅ Création de l'établissement en 3 étapes (nom, métier avec liste officielle + métiers validés, ville) ; métier hors liste → demande dans le super-admin
- ✅ Mesure d'audience maison sans cookie publicitaire ni service tiers (`/api/track`), première source gardée et enregistrée sur le compte à l'inscription → page Acquisition du super-admin
- ✅ Page 404 soignée, pages en maintenance (interrupteurs accueil / annuaire), message « compte désactivé », `metadataBase` et Open Graph
- ✅ Redirections des anciennes adresses (/login, /register, /search, /subscription, /panel, /appointment, /pro, /cgu…)

## Lot P — Mon site (créateur de site)
- ❌ Sections, modèles, thème, SEO, logo, réseaux, publication, aperçu, images, formulaire de contact, compteur de visites, domaine

## Lot Q — Emails et tâches planifiées ✅
- ✅ Confirmation, demande reçue, acceptée, refusée, annulation (client / pro), nouvelle réservation pour le pro, rappels (email / SMS / WhatsApp), mot de passe oublié, RDV déplacé (avec mot du pro), codes de vérification, liste d'attente, invitations, support
- ✅ Bienvenue au pro (premier établissement), relances « Bien démarrer » J+1 et J+3 (étapes restantes, s'arrêtent dès que c'est configuré), « créez votre établissement » (une fois, jamais aux comptes inscrits comme clients), fin d'accès offert J-7 et J-1 (avec le nombre de RDV du mois), limite mensuelle de confirmations automatiques atteinte (une fois par mois)
- ✅ Publication programmée du blog (toutes les 15 min)
- ✅ Crontab : `/api/cron/reminders` (15 min) et `/api/cron/daily` (10 h), protégées par `CRON_SECRET`, idempotentes ; relances déjà envoyées par l'ancien Branshee reprises à la migration
- ℹ️ « Tentative de réservation bloquée » : l'ancien bloquait les réservations au-delà de la limite ; la v2 ne bloque jamais (elles passent « à confirmer »), l'email « limite atteinte » le remplace
- ℹ️ Purge de l'historique des comptes gratuits volontairement abandonnée (perte de données patients) : l'historique est seulement masqué au-delà de 7 jours
- ℹ️ Script « mise en pause des fiches vides » de l'ancien non repris (action manuelle possible depuis le super-admin)

## Lot R — Langues
- ❌ Interface en 6 langues (fr, en, nl, de, es, it) — l'ancien a 2 039 textes traduits par langue

## Lot S — Applications
- ❌ API pour l'application mobile (connexion, agenda, clients, dossier, prestations, horaires, congés, équipe, notifications push…)
- ❌ Application de bureau (Electron)

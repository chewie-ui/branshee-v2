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

## Lot F — Réservation en ligne (client)
- ✅ Tunnel prestation → praticien → jour / créneau → coordonnées, revérification serveur, anti-robots
- ✅ Questionnaire, première visite, cours collectifs
- ✅ Styles de catégories (pastilles / accordéon / grille) — Lot C
- ✅ Mise en avant des créneaux regroupés — Lot D
- ❌ Paiement : en ligne (Stripe), prépaiement obligatoire ou au choix, empreinte de carte pour la politique d'annulation, infos virement (IBAN) / PayPal / QR code
- ❌ Connexion / inscription client dans le tunnel, incitation à créer un compte
- ✅ Ajout à l'agenda (.ics) · ❌ boutons Google / Apple / Outlook
- ❌ **Reprogrammer** son RDV soi-même (choix d'un nouveau créneau) — annulation ✅
- ❌ Avis : laisser un avis (note + commentaire), moyenne, signaler un avis (motifs)
- 🔶 Page établissement : infos ✅, horaires ✅, équipe ✅, FAQ ✅, carte ✅, galerie ✅, réseaux ✅, avis (lecture) ✅ (Lot E) · « ouvert aujourd'hui », copier email / téléphone, visionneuse de la galerie, « voir plus » ❌
- ❌ Page « établissement en pause » dédiée, installation comme application (PWA)

## Lot G — Espace client
- ❌ Tableau de bord : RDV à venir (déplacer, annuler, ajouter à l'agenda, adresse, réserver à nouveau), historique (laisser un avis, reprendre RDV), mes avis
- ❌ Paramètres : photo, nom, téléphone, civilité, date de naissance, adresse, notifications email, changer d'email, mot de passe, langue, cartes enregistrées
- ❌ Rattachement automatique des anciens RDV à un compte créé avec le même email

## Lot H — Paramètres du compte pro et paiements
- ❌ Profil : nom, photo, téléphone avec indicatif, changement d'email avec code
- ❌ Sécurité : changer le mot de passe, double authentification (TOTP)
- ❌ Langue de l'interface, notification « nouvelle réservation » (🔶 existe dans Réglages)
- ❌ Supprimer son compte (avec code), supprimer / mettre en pause un établissement (par le pro)
- ❌ **Stripe Connect** (connexion du compte, retour, rafraîchissement, saisie manuelle, déconnexion)
- ❌ Prépaiement, politique d'annulation (gratuite / 50 % sous 24 h / 100 % sous 12 h), décision rembourser / garder, pénalité d'absence
- ❌ Modes acceptés sur place : espèces, carte, virement (IBAN, BIC, banque, note), PayPal.me, QR code (image + note)
- ❌ Moyen de reversement (virement, PayPal, espèces, autre)

## Lot I — Établissements et équipe
- ✅ Plusieurs établissements, sélecteur, membres, invitations par email, grades, profil public des membres
- ❌ Page « Mes établissements » : modifier, supprimer, mettre en pause, forfait de chacun
- ❌ Rejoindre un établissement (recherche + demande), accepter / refuser les demandes, invitations reçues (accepter / refuser)
- ❌ Propriétaire réservable ou non (« afficher comme employé »)
- ❌ Infos complémentaires sur le profil public d'un membre (libellé / valeur) — schéma prêt
- ❌ Sièges collaborateurs supplémentaires (10 €/mois)

## Lot J — Abonnements (Branshee → pro)
- ❌ Forfaits par établissement (Gratuit / Pro / Business) et **limites** partout (prestations, membres, questions de formulaire, historique 7 jours, rappels, confirmations auto au-delà de 20 RDV/mois en gratuit, personnalisation, Google Agenda, grades et journal réservés à Business, Mon site…)
- ❌ Paiement Stripe (checkout), changement d'offre au prorata, résiliation, reprise, cartes, factures PDF, adresse de facturation
- ❌ Options : URL personnalisée, sièges
- ❌ Codes promo, campagne avec compte à rebours, liens d'accès offerts, essai gratuit
- ❌ Parrainage (code, lien, filleuls, mois offerts)
- 🔶 Accès offert par le super-admin ✅ (par compte ; à passer par établissement)

## Lot K — SMS et WhatsApp
- ❌ Rappel et confirmation par SMS, quota inclus par forfait, solde prépayé, recharge, recharge automatique, compteur mensuel, repli email
- ❌ WhatsApp (rappel, confirmation), repli SMS puis email

## Lot L — Intégrations
- ❌ Synchronisation Google Agenda (connexion, envoi des RDV, événements Google bloquants)
- ❌ Flux iCal personnel par membre — schéma prêt
- ❌ Connexion avec Google (pro et client)

## Lot M — Aide, support, accompagnement
- ❌ Centre d'aide (sections, vidéos, FAQ, visites guidées)
- ❌ Chat de support avec l'équipe + note de satisfaction
- ❌ Messages de l'équipe Branshee affichés aux pros (bannière, fermeture)
- ❌ Écran d'accueil + visite guidée, checklist « Bien démarrer »
- ❌ Emails de relance (J+1, J+3, « créez votre établissement »)

## Lot N — Super-admin
- ✅ Tableau de bord, établissements (recherche, fiche, pause, forfait offert), utilisateurs (désactivation)
- ❌ Export CSV (établissements, utilisateurs), suppression, essai, forfait par établissement
- ❌ Se connecter « en tant que » avec demande de supervision acceptée par le pro
- ❌ Journal global, acquisition (UTM, pages vues), parrainages, métiers proposés (valider / bloquer), mise en avant (boost)
- ❌ Codes promo, campagnes, liens d'accès
- ❌ Interrupteurs de fonctionnalités (maintenance…), masquage d'éléments du menu
- ❌ Chat de support, signalements d'avis, messages aux pros, éditeur du centre d'aide, éditeur de blog

## Lot O — Site public Branshee (marketing)
- ❌ Accueil, page pro, tarifs, contact (formulaire), confidentialité, CGU
- ❌ Annuaire : recherche par métier / ville, établissements mis en avant
- ❌ Pages SEO par métier (« logiciel rendez-vous kiné »…), blog, RSS, sitemap, IndexNow
- ❌ Inscription en plusieurs étapes avec choix du métier (+ demande de nouveau métier), page « Démarrer »
- ❌ Pages d'état : fonctionnalité en maintenance, compte désactivé, 404 soignée

## Lot P — Mon site (créateur de site)
- ❌ Sections, modèles, thème, SEO, logo, réseaux, publication, aperçu, images, formulaire de contact, compteur de visites, domaine

## Lot Q — Emails et tâches planifiées
- ✅ Confirmation, demande reçue, acceptée, refusée, annulation (client / pro), nouvelle réservation pour le pro, rappels, mot de passe oublié
- ❌ RDV déplacé (avec mot du pro), bienvenue pro, code de vérification, établissement mis en pause, limite mensuelle atteinte, tentative de réservation bloquée, rappel avant fin d'accès offert (J-7, J-1), relances
- ❌ Nettoyage de l'historique des comptes gratuits, publication programmée du blog

## Lot R — Langues
- ❌ Interface en 6 langues (fr, en, nl, de, es, it) — l'ancien a 2 039 textes traduits par langue

## Lot S — Applications
- ❌ API pour l'application mobile (connexion, agenda, clients, dossier, prestations, horaires, congés, équipe, notifications push…)
- ❌ Application de bureau (Electron)

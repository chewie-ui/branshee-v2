# Branshee v2 — Inventaire des fonctionnalités

Cahier des charges de la refonte. Tout ce qui existe dans l'ancien Branshee
(`chewie-ui/saas-rdv`, Express + MongoDB + Pug/EJS) est listé ici, regroupé par
domaine, pour que rien ne se perde. Chaque ligne cochée = reconstruite dans la v2.

Légende : 🟢 cœur (à faire en premier) · 🟡 important · ⚪ secondaire / plus tard

---

## 1. Comptes & authentification
- [ ] 🟢 Inscription / connexion pro (email + mot de passe)
- [ ] 🟢 Inscription / connexion client (comptes séparés des pros dans l'ancien code → **unifiés en v2**, un seul compte qui peut être pro, client ou les deux)
- [ ] 🟡 Connexion Google (pro et client) · ⚪ Apple
- [ ] 🟢 Mot de passe oublié (code par email)
- [ ] 🟡 Double authentification (TOTP)
- [ ] 🟡 Changement d'email (avec code de vérification), suppression de compte (avec code)
- [ ] ⚪ Historique des connexions, révocation des sessions (`tokenEpoch`)
- [ ] ⚪ Choix de la langue (fr, en, nl, de, es, it)

## 2. Établissements & équipe
- [ ] 🟢 Un pro possède un ou plusieurs **établissements** ; bascule entre établissements
- [ ] 🟢 Fiche établissement : nom, métier, photo, description, « À propos » (texte riche), coordonnées pro, réseaux sociaux, site web, adresse (sur place / en ligne / intégration carte)
- [ ] 🟢 Lien public personnalisé (`slug`), vérification de disponibilité
- [ ] 🟡 Mettre en pause / reprendre un établissement, suppression
- [ ] 🟢 **Collaborateurs** : invitation, demande pour rejoindre (et acceptation), activation/désactivation, retrait
- [ ] 🟢 **Grades & permissions** : grades créés par le patron, permissions fines par domaine
  (rendez-vous voir/gérer/annuler, clients voir/gérer, prestations, cours collectifs,
  disponibilités partagées / les siennes / celles des autres, congés les siens / ceux des autres,
  formulaires, personnalisation, réglages, collaborateurs, grades, journal, facturation,
  établissement gérer/supprimer)
- [ ] 🟢 Profil public de chaque collaborateur (nom affiché, photo, description, rôle visible, infos perso), le patron peut aussi être « employé »
- [ ] 🟡 Journal d'activité (qui a fait quoi)

## 3. Prestations (services)
- [ ] 🟢 CRUD prestations : nom, description, prix (ou non défini), durée (fixe ou plage min–max), catégorie, couleur, image, ordre, actif/inactif
- [ ] 🟢 Prestations **individuelles** ou **collectives** (capacité)
- [ ] 🟢 Collaborateurs assignés à chaque prestation
- [ ] 🟡 Catégories avec icône, style d'affichage (pastilles / accordéon / grille)
- [ ] 🟡 Lieu spécifique par prestation
- [ ] 🟡 Frais d'annulation par prestation (% ou montant)
- [ ] 🟡 Question « première visite ? » + questionnaire qui filtre les prestations proposées
- [ ] ⚪ Activation en masse, réorganisation par glisser-déposer, colonnes masquables

## 4. Cours collectifs
- [ ] 🟡 Séances ponctuelles (date, début, fin) ou récurrentes (jours + heure)
- [ ] 🟡 Liste des participants par séance
- [ ] 🟡 Option : une séance bloque les rendez-vous individuels

## 5. Disponibilités & agenda
- [ ] 🟢 Horaires hebdomadaires (plusieurs plages par jour, jours fermés)
- [ ] 🟢 Mode **horaires partagés** ou **horaires par collaborateur**
- [ ] 🟢 Congés / jours fermés / horaires exceptionnels à une date, par collaborateur
- [ ] 🟢 Droit pour un collaborateur de gérer lui-même ses congés
- [ ] 🟢 Créneaux : durée, mode fixe ou intervalle, temps tampon avant / après
- [ ] 🟡 Délai minimum avant réservation, horizon de réservation (jours)
- [ ] 🟡 Regroupement intelligent (proposer les créneaux proches des RDV existants)
- [ ] 🟡 Confirmation automatique ou manuelle, liste d'attente, surréservation autorisée
- [ ] 🟢 Agenda pro (vue semaine/jour), créer un RDV, bloquer un créneau, déplacer, annuler, restaurer
- [ ] 🟢 Demandes en attente : confirmer / refuser
- [ ] 🟡 Notes internes sur un RDV, changer le collaborateur assigné
- [ ] 🟡 Absence (no-show) avec motif justifié/injustifié
- [ ] 🟡 Historique des RDV, recherche, modification avec détection de conflits
- [ ] 🟡 Personnalisation des couleurs de l'agenda

## 6. Réservation en ligne (côté client)
- [ ] 🟢 Page publique de l'établissement : infos, prestations, équipe, avis, galerie, FAQ, équipements, horaires, carte, badges — sections activables et réordonnables
- [ ] 🟢 Tunnel : prestation → collaborateur (optionnel) → jour → créneau → coordonnées → confirmation
- [ ] 🟢 Formulaire avant réservation (texte / choix / oui-non, obligatoire ou non)
- [ ] 🟢 Lien d'annulation et de **reprogrammation** sécurisé (jeton)
- [ ] 🟡 Téléphone obligatoire ou non
- [ ] 🟡 Calendrier intégrable sur un site externe (embed) avec thème personnalisable
- [ ] 🟡 Recherche d'établissements par métier / ville (annuaire public)

## 7. Paiements
- [ ] 🟡 **Stripe Connect** pour l'établissement (encaisser les clients)
- [ ] 🟡 Prépaiement facultatif ou obligatoire, empreinte de carte (setup intent)
- [ ] 🟡 Politique d'annulation (gratuite / 50 % sous 24 h / 100 % sous 12 h), décision rembourser/garder
- [ ] 🟡 Moyens acceptés sur place : espèces, carte, virement (IBAN), PayPal, QR code (image)
- [ ] 🟡 Suivi du paiement par RDV (méthode, statut, montant, pénalité)

## 8. Clients (CRM)
- [ ] 🟢 Fiche client par établissement : coordonnées, contacts alternatifs, infos générales
- [ ] 🟢 **Dossier** : entrées datées (titre, note, à faire, pièce jointe) — données sensibles, chiffrées
- [ ] 🟢 Historique des RDV du client
- [ ] 🟡 Bloquer / débloquer un client (motif)
- [ ] 🟡 Fusion de doublons, recherche, création manuelle
- [ ] 🟡 Espace client : mes RDV, profil, photo, email, mot de passe, langue

## 9. Notifications
- [ ] 🟢 Emails : confirmation, rappel (délai réglable 6–72 h), annulation, nouvelle réservation pour le pro — messages personnalisables
- [ ] 🟡 SMS (crédit prépayé, recharge auto, alerte solde bas, compteur mensuel)
- [ ] 🟡 WhatsApp (rappels + confirmations)
- [ ] ⚪ Notifications push (app mobile)
- [ ] 🟡 Messages du super-admin aux pros (individuel ou à tous)

## 10. Avis
- [ ] 🟡 Avis clients (note 1–5 + commentaire), un par client et par établissement
- [ ] 🟡 Signalement (visiteur / utilisateur / pro) avec copie de l'avis, modération par le super-admin

## 11. Créateur de site (« Mon site »)
- [ ] 🟡 Site par établissement : sections (hero, prestations, réservation, à propos, galerie, témoignages, FAQ, contact, chiffres, appel à l'action), thème (couleurs, polices, arrondis), modèles, SEO, logo, réseaux
- [ ] 🟡 Publication, aperçu, upload d'images, domaine personnalisé, formulaire de contact, compteur de visites
- 👉 En v2, ce sera la base de la **plateforme « site + modules »** (cf. vision Skydev)

## 12. Abonnements & facturation (Branshee → pro)
- [ ] 🟢 Forfaits : Amateur (gratuit), Pro (19 €/mois, 15 € en annuel), Pro+ (49 €/mois, 39 € en annuel) — limites par forfait (`planLimits`)
- [ ] 🟢 Options : URL personnalisée (+5 €/mois), siège collaborateur supplémentaire (+10 €/mois)
- [ ] 🟡 Moyens de paiement, reprise d'abonnement, résiliation
- [ ] 🟡 Codes promo (%, montant, essai), campagne promo avec compte à rebours, liens d'accès offerts
- [ ] 🟡 Parrainage (code, filleuls inscrits / payants, mois offerts)
- 👉 En v2 : système de **modules** activables (rendez-vous, téléphone IA Alowi, SMS, site, etc.)

## 13. Intégrations
- [ ] 🟡 Synchronisation Google Agenda (OAuth)
- [ ] 🟡 Flux iCal (jeton)
- ⚪ Application mobile (API JWT) et application de bureau (Electron) — à reprendre plus tard sur l'API v2

## 14. Super-admin
- [ ] 🟡 Tableau de bord, établissements et utilisateurs (détails, export, pause, suppression, désactivation)
- [ ] 🟡 Attribuer un forfait / un essai / un accès offert avec échéance
- [ ] 🟡 Se connecter « en tant que » (avec demande de supervision acceptée par le pro)
- [ ] 🟡 Métiers proposés par les pros (valider / bloquer)
- [ ] 🟡 Mise en avant (boost) dans l'annuaire
- [ ] 🟡 Feature flags (actif / maintenance / erreur / désactivé), masquage d'éléments de navigation
- [ ] 🟡 Chat de support + note de satisfaction ; centre d'aide (sections, vidéos, FAQ)
- [ ] 🟡 Blog (brouillon, programmé, publié, SEO, RSS, sitemap)
- [ ] ⚪ Journal global, signalements d'avis, CRM abonnés

## 15. Marketing & acquisition
- [ ] 🟡 Pages publiques : accueil, tarifs, contact, confidentialité, CGU, pages SEO par métier (« logiciel rendez-vous kiné »…)
- [ ] ⚪ Suivi d'attribution (UTM, gclid, page d'atterrissage), pages vues
- [ ] ⚪ Relances d'onboarding (J+1, J+3), checklist de démarrage

## 16. Tâches planifiées (cron)
- Toutes les 15 min : rappels de RDV
- 03:00 : nettoyage de l'historique des comptes gratuits
- 09:00 : rappels avant expiration d'un accès offert (J-7, J-1)
- 10:00 / 10:30 : relances d'onboarding
- Blog : publication programmée

---

## Défauts de l'ancien code corrigés par conception en v2
- `Booking.company` pointe vers `User` alors que `Review.company` pointe vers `Company` → **un seul modèle Établissement** partout.
- Infos dupliquées entre `User` et `Company` (réseaux, description, adresse, réglages d'agenda) → chaque info n'existe qu'à un endroit.
- `Employee` (ancien) et `CompanyMembership` (nouveau) coexistent → **un seul modèle Membre**.
- Clients pros et clients finaux dans deux collections (`User` / `Client`) → **un seul compte utilisateur**.
- Heures stockées en texte (`"09:30"`) → types temporels Postgres, chevauchements de RDV interdits par la base.
- Plusieurs versions de pages en parallèle (`availability-v2/-old/-new`, `services-v2/-old`) → une seule version.

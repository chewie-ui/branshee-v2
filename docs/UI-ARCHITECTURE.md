# Architecture de l'interface

Objectif : qu'un kiné ou une coiffeuse trouve chaque option **là où il la cherche**, sans
formation. Règles appliquées partout :

1. **Le quotidien d'abord.** Ce qu'on fait tous les jours (voir sa journée, gérer un RDV,
   retrouver un client) est à un clic. Ce qu'on règle une fois (paiements, notifications)
   est rangé dans Réglages.
2. **Une option = un seul endroit.** L'ancien code avait des réglages éparpillés entre
   « Mon compte », « Paramètres », « Personnaliser » et « Mon site ». Chaque réglage a
   maintenant une seule adresse.
3. **Une action principale par écran**, en haut à droite (« Nouveau rendez-vous »,
   « Ajouter un client », « Nouvelle prestation »).
4. **Les permissions masquent, elles ne désactivent pas.** Un collaborateur sans droit sur
   les prestations ne voit pas l'entrée « Prestations ».

## Espace pro — navigation latérale

```
[Sélecteur d'établissement ▾]

QUOTIDIEN
  Aujourd'hui        → RDV du jour, demandes à valider, prochaines disponibilités, chiffres de la semaine
  Agenda             → semaine / jour, par membre ; créer, déplacer, bloquer, annuler
  Clients            → liste + fiche (coordonnées, historique, dossier, notes)

ORGANISATION
  Prestations        → onglets : Prestations · Catégories · Cours collectifs
  Équipe             → onglets : Membres · Grades et permissions · Invitations
  Horaires           → onglets : Horaires de la semaine · Congés et fermetures

EN LIGNE
  Page de réservation→ aperçu en direct + onglets : Contenu · Apparence · Formulaire · Partager (lien, QR, intégration)
  Site web           → module « Site » (créateur de site)
  Modules            → catalogue : Rendez-vous, Rappels SMS, WhatsApp, Téléphone IA, Paiement en ligne…

────────────
  Réglages
  Aide et support
[Avatar ▾ → Mon compte, Changer d'espace (client), Déconnexion]
```

## Réglages — rangés par question que se pose l'utilisateur

| Section | Contenu (ancien emplacement) |
|---|---|
| **Établissement** | nom, métier, adresse, coordonnées, réseaux, photo, lien public (`informations`, `update-info`, `slug`, `location`) |
| **Règles de réservation** | durée des créneaux, tampons, délai minimum, horizon, confirmation auto, liste d'attente, surréservation, regroupement intelligent, téléphone obligatoire, question « première visite » (`company/*`, `phone-required`) |
| **Paiements** | Stripe Connect, prépaiement, politique d'annulation, moyens acceptés sur place (`settings/prepayment`, `cancellation-policy`, `stripe-connect`) |
| **Notifications** | délai de rappel, messages personnalisés, emails au pro, SMS, WhatsApp, crédit SMS (`reminder-settings`, `sms`, `settings/notifications`) |
| **Intégrations** | Google Agenda, flux iCal (`googleCalendar`, `ical`) |
| **Abonnement** | forfait, modules actifs, sièges, factures, moyens de paiement, parrainage, code promo (`subscription`, `parrainage`) |
| **Journal d'activité** | qui a fait quoi (`logs`) |
| **Zone sensible** | mettre en pause, supprimer l'établissement |

## Mon compte (personnel, indépendant de l'établissement)
Profil, email, mot de passe, double authentification, langue, connexions, suppression du compte.

## Côté client
- Page publique `/{slug}` : en-tête (photo, nom, note, adresse) → prestations groupées par catégorie →
  équipe → avis → infos pratiques. Bouton « Prendre rendez-vous » toujours visible.
- Tunnel en une page qui avance par étapes : Prestation → Praticien (si plusieurs) → Date et heure → Vos coordonnées → Confirmation.
- Espace client : Mes rendez-vous (à venir / passés, annuler, reprogrammer), Mon profil.

## Super-admin (`/admin`)
Tableau de bord · Établissements · Utilisateurs · Abonnements (codes promo, campagnes, liens d'accès) ·
Modération (avis signalés, métiers proposés) · Support (chat, centre d'aide) · Contenu (blog, messages aux pros) ·
Système (feature flags, journal).

# Branshee v2

Refonte complète de Branshee : prise de rendez-vous en ligne pour indépendants et petites équipes,
pensée comme une plateforme à modules.

**Stack** : Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 · PostgreSQL + Drizzle ORM · Zod

## Documentation
- [`docs/FEATURES.md`](docs/FEATURES.md) — inventaire complet des fonctionnalités de l'ancien Branshee (cahier des charges)
- [`docs/UI-ARCHITECTURE.md`](docs/UI-ARCHITECTURE.md) — organisation de l'interface : où va chaque option
- [`docs/MIGRATION.md`](docs/MIGRATION.md) — correspondance MongoDB → PostgreSQL et plan de bascule
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — mise en ligne sur le VPS, variables, crontab, sauvegardes

## Démarrer en local
```bash
npm install
cp .env.example .env.local          # puis renseigner DATABASE_URL
npm run db:migrate                  # crée les tables + contraintes
npm run db:seed                     # établissement de démonstration (données fictives)
                                    # connexion : claire@cabinet-horizon.example / demo-branshee-2026
npm run dev                         # http://localhost:3000
```

## Scripts
| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm start` | build et serveur de production |
| `npm run typecheck` | vérification TypeScript |
| `npm run lint` | ESLint |
| `npm test` | tests unitaires (moteur de créneaux…) |
| `npm run db:generate` | génère une migration après modification du schéma |
| `npm run db:migrate` | applique les migrations |
| `npm run db:seed` | recrée la démo |
| `npm run db:studio` | explorateur de base Drizzle |

## Organisation du code
```
src/
  app/app/            espace pro (Aujourd'hui, Agenda, Clients, Prestations…)
  components/ui/      composants de base (bouton, carte, champ, badge…)
  components/app/     composants métier (barre latérale, formulaires…)
  db/schema/          schéma PostgreSQL, un fichier par domaine
  lib/                utilitaires (permissions, dates, navigation)
  server/             accès aux données et actions serveur
drizzle/              migrations SQL
scripts/              seed, migration depuis MongoDB
```

## Lancer en local (le plus simple)
Seul prérequis : **Node.js** (version LTS, https://nodejs.org).

- **Windows** : double-clic sur `demarrer-local.bat`
- **Mac / Linux** : `npm install` puis `npm run local`

La base PostgreSQL est fournie et stockée dans `.local/` (rien à installer). Au premier lancement : création de la base, migrations et données de démo. Puis ouvrir http://localhost:3000 :
- `claire@cabinet-horizon.example` (propriétaire), `thomas@cabinet-horizon.example` (collaborateur), `admin@branshee.example` (super-admin, `/admin`)
- mot de passe : `demo-branshee-2026`
- les emails s'affichent dans le terminal au lieu de partir.

## Avancement
**Fait — fondations**
- Schéma complet (51 tables) couvrant toutes les données de l'ancien Branshee, chevauchements de RDV interdits par la base
- Système de permissions par grade (source unique : `src/lib/permissions.ts`)
- Design system (tokens de couleur à contraste vérifié, composants), navigation responsive
- Aujourd'hui (stats, demandes à valider avec confirmer/refuser, journée, lien de réservation)
- Agenda semaine avec une colonne par membre, filtre par membre
- Création d'un rendez-vous (client existant ou nouveau, détection de conflit)
- Clients (recherche) et fiche client (coordonnées, à venir, historique, absences)
- Prestations par catégorie
- Comptes et connexion : inscription, connexion, sessions sécurisées, création d'établissement, sélecteur d'établissement
- Horaires : grille hebdomadaire (commune ou par membre), congés et fermetures, permissions respectées
- Moteur de calcul des créneaux libres (`src/lib/booking/slots.ts`), testé (`npm test`) — y compris les changements d'heure
- Créneaux libres proposés dans le formulaire de création de RDV
- Page publique `/{slug}` + tunnel de réservation (prestation → praticien → jour/heure → coordonnées), revérification du créneau côté serveur, anti-robots et limitation d'abus
- Page client `/r/{jeton}` : récapitulatif, ajout à l'agenda (.ics), annulation
- Emails : confirmation, demande reçue, acceptation, refus, annulation, notification au pro, rappels automatiques (`/api/cron/reminders`), journal des envois
- Mot de passe oublié (code à 6 chiffres par email, sessions fermées après changement)
- Prestations : création, modification, catégories, couleur, praticiens, masquer, supprimer
- Réglages : établissement (dont lien public), règles de réservation (créneaux, battements, délais, confirmation, question « première visite »), notifications
- Dossier client : fiche modifiable, informations générales et notes de suivi chiffrées (AES-256-GCM), blocage
- Détail d'un RDV : réponses au formulaire, message, paiement, présence/absence, note interne, annulation (client prévenu)
- Page de réservation : lien et code d'intégration, questions posées avant réservation, FAQ, couleur principale
- Journal d'activité filtrable
- Script de migration MongoDB → PostgreSQL (`npm run migrate:mongo`, voir docs/MIGRATION.md)
- Équipe : ajout de membres (avec invitation par email, reliée automatiquement à l'inscription), profil, grade, désactivation, retrait ; grades personnalisés avec grille de permissions
- Cours collectifs : capacité, séances ponctuelles ou répétées chaque semaine, inscription en ligne avec places restantes (capacité garantie même en cas d'inscriptions simultanées), liste des participants, annulation d'une séance (participants prévenus), séance affichée une seule fois dans l'agenda, agenda de l'animateur bloqué (option)
- Super-admin `/admin` : tableau de bord, établissements (recherche, fiche, pause de la réservation en ligne, forfait offert), utilisateurs (désactivation) ; accès via `npm run admin:grant`

**Prochaines étapes**
1. Mon compte, aide, modules
2. Connexion Google, double authentification, reprogrammation par le client
3. Paiements (Stripe Connect), abonnements Stripe, SMS/WhatsApp, avis, créateur de site

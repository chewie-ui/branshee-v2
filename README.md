# Branshee v2

Refonte complète de Branshee : prise de rendez-vous en ligne pour indépendants et petites équipes,
pensée comme une plateforme à modules.

**Stack** : Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 · PostgreSQL + Drizzle ORM · Zod

## Documentation
- [`docs/FEATURES.md`](docs/FEATURES.md) — inventaire complet des fonctionnalités de l'ancien Branshee (cahier des charges)
- [`docs/UI-ARCHITECTURE.md`](docs/UI-ARCHITECTURE.md) — organisation de l'interface : où va chaque option
- [`docs/MIGRATION.md`](docs/MIGRATION.md) — correspondance MongoDB → PostgreSQL et plan de bascule

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

**Prochaines étapes**
1. Page publique et tunnel de réservation client (branché sur le moteur de créneaux)
2. Mot de passe oublié, connexion Google, double authentification (nécessitent l'envoi d'emails)
3. Emails (confirmation, rappel, annulation) et tâches planifiées
4. Équipe, grades, réglages
5. Script de migration depuis MongoDB
6. Paiements, SMS/WhatsApp, avis, site, super-admin

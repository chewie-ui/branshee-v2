# Migration MongoDB → PostgreSQL

Principe : **on copie, on ne supprime jamais.** L'ancienne base MongoDB reste intacte
jusqu'à la bascule définitive. Chaque ligne Postgres garde l'`_id` Mongo d'origine dans
`legacy_id`, donc le script peut être relancé sans créer de doublons (upsert sur `legacy_id`).

⚠️ La base contient des données de santé (dossiers clients). Le script tourne **sur le VPS**,
jamais en local, et aucun export n'est envoyé ailleurs.

## Correspondance des collections

| MongoDB (ancien) | PostgreSQL (v2) | Remarques |
|---|---|---|
| `users` (pros) | `users` + `subscriptions` + `sms_wallets` + `google_calendar_connections` | `subscription.*`, `isPremium/manualPremium*` → `subscriptions` (`granted_until`) ; `smsBalanceCents`, `smsAutoRecharge` → `sms_wallets` |
| `clients` (comptes clients) | `users` | Fusion sur l'email : si un pro a le même email qu'un client, un seul compte |
| `users.calendarSettings`, `businessName`, `location`, réseaux… | `businesses`, `booking_page_settings`, `notification_settings` | Données business qui étaient dupliquées dans `User` |
| `companies` | `businesses` + `booking_settings` + `payment_settings` | `schedule` → `weekly_hours` (memberId null) ; `slotTime/bufferTime/slotMode…` → `booking_settings` |
| `companies.ownerEmployeeProfile` | `members` (`is_owner = true`) | |
| `companymemberships` | `members` | `schedule` → `weekly_hours` (memberId = membre) |
| `employees` (ancien modèle) | `members` (sans `user_id`) | |
| `companygrades` | `grades` | Permissions renommées : `clients`→`customers`, `collaborators`→`team`, `establishment`→`business`, `appointments.cancelDelete`→`cancel` |
| `daysoffs` | `schedule_exceptions` | Une ligne par date et par membre (`employees[]` éclaté) |
| `services` | `services` + `service_members` + `group_sessions` | `price` (euros) → `price_cents` ; `sessions[]` → `group_sessions` ; `category` (texte) → `service_categories` |
| `companies.serviceQuestionnaire` + `services.questionRules` | `intake_questions` + `intake_options` + `service_intake_rules` | |
| `forms` | `form_questions` | |
| `books` | `appointments` + `appointment_payments` | `date` + `startTime`/`endTime` (texte) → `starts_at`/`ends_at` (timestamptz, fuseau de l'établissement) ; `isBlock` → `kind = 'block'` ; `canceled` → `cancelled` ; `cancelToken` → `manage_token` (conservé : les liens déjà envoyés restent valides) |
| `clientdossiers` | `customers` + `customer_notes` | `generalInfo`, `entries[].note/todo` re-chiffrés ; pièces jointes copiées telles quelles |
| `reviews`, `reviewreports` | `reviews`, `review_reports` | |
| `sites` | `sites` | |
| `subscriptions` (historique) | — | Seul l'abonnement courant est repris ; l'historique reste dans Stripe |
| `promocodes`, `promocampaigns`, `accesslinks` | `promo_codes` + `promo_redemptions`, `promo_campaigns`, `access_links` + `access_link_uses` | |
| `activitylogs`, `adminmessages`, `supportchats`, `supportcontents`, `supportratings`, `articles`, `featureflags`, `jobtitles`, `loginevents`, `pushtokens`, `pageviews` | tables du même nom | `supportchats.messages[]` → `support_messages` |

## Pièges connus de l'ancienne base
- `books.company` et `clientdossiers.company` pointent vers un **User**, pas une Company → résoudre via `User.company`.
- Doublons d'infos entre `User` et `Company` : la valeur de `Company` gagne si elle est remplie, sinon celle de `User`.
- Le plan « essentiel » est abandonné : il retombe sur `free` (aucune fonctionnalité perdue, cf. `planLimits.js`).
- Heures en texte : valider le format `HH:MM` avant conversion ; les RDV invalides sont listés dans le rapport, jamais ignorés en silence.

## Le script : `scripts/migrate-from-mongo.ts`

```bash
# Sur le VPS, avec la base v2 créée et migrée (npm run db:migrate)
export MONGO_URI="mongodb://…/branshee"        # l'ancienne base (lecture seule suffit)
export DATABASE_URL="postgres://…/branshee"     # la nouvelle
export DATA_ENCRYPTION_KEY="…"                  # 64 caractères hex, la même que l'app en production

npm run migrate:mongo -- --dry-run              # essai à blanc : rapport seul, rien n'est écrit
npm run migrate:mongo                           # migration réelle (une seule transaction)
npm run migrate:mongo -- --force                # rejouer : remplace la migration précédente
```

- **Tout ou rien** : une seule transaction ; à la moindre erreur, PostgreSQL reste intact.
- **Rapport** `migration-report.json` : nombre de documents lus, de lignes écrites par table, et la liste des anomalies (RDV à l'heure invalide, établissements supprimés ignorés, chevauchements conservés en « surréservation », membres sans horaires, 2FA à réactiver…).
- **Mots de passe** : les hash bcrypt de l'ancien Branshee sont acceptés tels quels et remplacés par un hash scrypt à la première connexion. Personne n'a à réinitialiser son mot de passe.
- **Liens déjà envoyés** : le jeton d'annulation de chaque RDV est conservé, les liens dans les anciens emails restent valides.
- **Données sensibles** : informations générales et notes des dossiers clients, et jetons Google Agenda, sont chiffrés (AES-256-GCM) pendant la copie.
- Alternative sans accès direct à MongoDB : `mongoexport --jsonArray` de chaque collection dans un dossier, puis `--json <dossier>`.
- Test sur données fictives : `npm run migrate:sample` (génère un faux export couvrant les cas limites et l'importe à blanc).

## Étapes de la bascule
1. `pg_dump` vide de la v2 + `mongodump` de sécurité de l'ancienne base.
2. Lancer `npm run migrate:mongo -- --dry-run` → lire le rapport (comptes par table, anomalies).
3. Lancer pour de vrai, puis vérifier dans l'app quelques agendas et dossiers clients. Copier les fichiers de l'ancien serveur :
   ```bash
   mkdir -p "$STORAGE_DIR"
   cp -r /chemin/ancien-branshee/public/uploads/.  "$STORAGE_DIR/legacy-public/"    # photos, logos (servis sur /uploads/… comme avant)
   cp -r /chemin/ancien-branshee/private_uploads/. "$STORAGE_DIR/legacy-private/"   # PDF des dossiers clients
   ```
   Les PDF envoyés depuis la v2 sont chiffrés ; ceux de l'ancien Branshee restent lisibles tels quels.
4. Mettre l'ancien site en lecture seule, dernière passe incrémentale, puis bascule DNS.
5. Ancienne version gardée prête à être rallumée pendant 2 semaines.

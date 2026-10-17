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

## Étapes de la bascule
1. `pg_dump` vide de la v2 + `mongodump` de sécurité de l'ancienne base.
2. Lancer `scripts/migrate-from-mongo.ts` en mode `--dry-run` → rapport (comptes par table, anomalies).
3. Lancer pour de vrai, puis le script de vérification (mêmes totaux, échantillon de RDV comparés).
4. Mettre l'ancien site en lecture seule, dernière passe incrémentale, puis bascule DNS.
5. Ancienne version gardée prête à être rallumée pendant 2 semaines.

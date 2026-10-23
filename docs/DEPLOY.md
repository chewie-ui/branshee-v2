# Déploiement sur le VPS

## Bascule de branshee.com vers la v2 (script tout-en-un)
```bash
cd /var/www/branshee-v2 && git pull
bash deploy/production.sh prepare    # prépare la production sans rien couper (relançable)
bash deploy/production.sh twilio     # ajoute les clés Twilio (demandées au clavier, jamais affichées)
bash deploy/production.sh cutover    # le jour J : maintenance ~5 min, migration finale, branshee.com → v2
bash deploy/production.sh rollback   # retour immédiat à l'ancien Branshee si besoin
bash deploy/production.sh update     # mises à jour du code après la bascule
```
`prepare` crée `/var/www/branshee-prod` (base `branshee_prod`, port 3060) et une config reprise de l'ancien `.env`
(Stripe live, prix, webhook) et de la version de test (SMTP Resend, Google). Le webhook Stripe existant
(`https://www.branshee.com/account/webhook`) reste valable : la v2 sert cette adresse ; `cutover` lui ajoute les
événements d'abonnement. `cutover` installe aussi les tâches planifiées (rappels, relances) et la sauvegarde quotidienne.


## Prérequis
- Node.js 22, PostgreSQL 16, Nginx (reverse proxy + HTTPS via Let's Encrypt)
- Un compte SMTP pour les emails (l'ancien Branshee utilisait Brevo : `smtps://LOGIN:CLE@smtp-relay.brevo.com:465`)

## Variables d'environnement (`.env.production`, jamais committé)
| Variable | Rôle |
|---|---|
| `DATABASE_URL` | connexion PostgreSQL (utilisateur dédié, pas `postgres`) |
| `APP_URL` | adresse publique, ex. `https://branshee.com` (liens dans les emails) |
| `SMTP_URL` | serveur d'envoi des emails ; vide = emails seulement affichés dans les logs |
| `MAIL_FROM` | expéditeur, ex. `Branshee <no-reply@branshee.com>` (domaine vérifié SPF/DKIM) |
| `CRON_SECRET` | secret partagé avec la crontab (`openssl rand -hex 32`) |
| `DATA_ENCRYPTION_KEY` | clé de chiffrement des dossiers clients (`openssl rand -hex 32`). **À sauvegarder à part : sans elle, les dossiers sont illisibles.** |

## Mise en ligne
```bash
npm ci
npm run db:migrate          # migrations + contraintes (idempotent)
npm run build
npm start                   # à lancer via systemd ou pm2, derrière Nginx
```

## Tâches planifiées (crontab de l'utilisateur qui fait tourner l'app)
```cron
# Rappels de rendez-vous + articles de blog programmés, toutes les 15 minutes
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" https://branshee.com/api/cron/reminders > /dev/null
# Relances (bien démarrer J+1/J+3, créez votre établissement) et fin d'accès offert (J-7/J-1), chaque jour à 10 h
0 10 * * * curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" https://branshee.com/api/cron/daily > /dev/null
```
Tout est idempotent : un RDV n'est rappelé qu'une fois et chaque relance n'est envoyée qu'une fois, même si deux exécutions se chevauchent.
Les relances respectent la case « Recevoir les emails d'information » du compte ; les comptes inscrits comme clients n'en reçoivent pas.

## Sauvegardes
```cron
# Dump quotidien de la base à 3h, conservé 14 jours
0 3 * * * pg_dump "$DATABASE_URL" | gzip > /var/backups/branshee/$(date +\%F).sql.gz && find /var/backups/branshee -mtime +14 -delete
```

## Points d'attention
- La limitation des tentatives de connexion est en mémoire : elle suppose **une seule instance** de l'app.
- Les données des dossiers clients sont des données de santé : base et sauvegardes chiffrées au repos, accès SSH par clé uniquement.

## Accès super-admin (`/admin`)
Créez d'abord votre compte normalement sur l'app, puis sur le VPS :
```bash
npm run admin:grant -- votre@email.com          # donne l'accès à /admin
npm run admin:grant -- votre@email.com --remove # le retire
```
Pour tout autre compte, `/admin` répond 404. L'espace admin n'affiche aucune donnée de dossier client.

## Stripe (paiements des clients et abonnements)

1. Clés : `STRIPE_SECRET_KEY` et `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (les mêmes que l'ancien Branshee).
2. Prix des abonnements : reprendre les identifiants `price_…` existants dans Stripe —
   `STRIPE_PRICE_PRO_MONTHLY` / `_YEARLY` (ancien « premium »), `STRIPE_PRICE_PROPLUS_MONTHLY` / `_YEARLY` (ancien « business »),
   `STRIPE_PRICE_CUSTOM_URL`, `STRIPE_PRICE_EXTRA_SEAT`. Les abonnements en cours restent valables.
3. Webhook : dans Stripe › Développeurs › Webhooks, ajouter `https://<domaine>/api/stripe/webhook` avec les événements
   `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_failed`,
   puis mettre le secret dans `STRIPE_WEBHOOK_SECRET`.
4. Portail client (cartes, factures) : l'activer une fois dans Stripe › Paramètres › Billing › Portail client.
5. Stripe Connect : activer Connect (comptes Express) — comme pour l'ancien.

## Google (connexion et Google Agenda)

Dans Google Cloud › Identifiants, sur le client OAuth existant : ajouter l'URI de redirection
`https://<domaine>/auth/google/retour` (une seule adresse pour la connexion et l'agenda), puis renseigner
`GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`. Les connexions Google Agenda de l'ancien Branshee sont reprises
par la migration (jetons chiffrés). Les flux iCal gardent la même adresse (`/ical/<jeton>`).

## Application mobile et application de bureau
- **Mobile** : l'application déjà publiée (`branshee-app`) parle à `/api/v1` ; la v2 sert le même contrat. Reporter
  `GOOGLE_CLIENT_ID_IOS`, `GOOGLE_CLIENT_ID_ANDROID`, `GOOGLE_CLIENT_ID_WEB`, `APPLE_BUNDLE_ID` (et `APPLE_SERVICE_ID`
  s'il existe) depuis l'ancien `.env`. Les comptes de l'app se reconnectent une fois après la bascule (les jetons de
  l'ancien serveur ne sont pas repris). Notifications push : service Expo, rien à configurer côté serveur.
- **Bureau** : dossier `desktop/` (Electron), voir `desktop/README.md` pour construire les installateurs.

## Domaines personnalisés (« Mon site », Pro+)
Le pro saisit son domaine dans Mon site › Réglages et crée chez son registraire un CNAME vers le domaine de l'app.
Le serveur web doit ensuite accepter ce domaine et obtenir un certificat :
- **Caddy** (le plus simple) : `on_demand_tls` avec une route `ask` qui vérifie le domaine, puis un bloc `https:// { reverse_proxy 127.0.0.1:3000 }`.
- **Nginx + certbot** : ajouter le domaine au `server_name`, puis `certbot --nginx -d www.domaine-du-pro.be`.
L'app reconnaît le domaine via l'en-tête `Host` (transmettre `proxy_set_header Host $host;`) et affiche le site à « / ».

## SMS (Twilio)
1. Compte Twilio payant (Upgrade), **recharge automatique** dans Admin › Billing (ex. +20 $ sous 10 $).
2. Messaging › Settings › Geo permissions : autoriser la Belgique (et France / Pays-Bas si besoin).
3. Dans `.env.production` : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `SMS_SENDER=Branshee` (11 caractères max).
4. Super-admin › Fonctionnalités : allumer « Notifications SMS / WhatsApp ».
Les SMS inclus (Pro 10 / Pro+ 30 par mois) sont couverts par l'abonnement, les SMS en plus par le crédit prépayé du pro (0,36 € TVAC) :
le solde Twilio ne baisse que pour des SMS déjà payés. Chaque rappel tient en un seul SMS (160 caractères, lien court /g/…).

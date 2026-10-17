# Déploiement sur le VPS

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

## Mise en ligne
```bash
npm ci
npm run db:migrate          # migrations + contraintes (idempotent)
npm run build
npm start                   # à lancer via systemd ou pm2, derrière Nginx
```

## Tâches planifiées (crontab de l'utilisateur qui fait tourner l'app)
```cron
# Rappels de rendez-vous, toutes les 15 minutes
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" https://branshee.com/api/cron/reminders > /dev/null
```
L'envoi est idempotent : un RDV n'est rappelé qu'une fois, même si deux exécutions se chevauchent.

## Sauvegardes
```cron
# Dump quotidien de la base à 3h, conservé 14 jours
0 3 * * * pg_dump "$DATABASE_URL" | gzip > /var/backups/branshee/$(date +\%F).sql.gz && find /var/backups/branshee -mtime +14 -delete
```

## Points d'attention
- La limitation des tentatives de connexion est en mémoire : elle suppose **une seule instance** de l'app.
- Les données des dossiers clients sont des données de santé : base et sauvegardes chiffrées au repos, accès SSH par clé uniquement.

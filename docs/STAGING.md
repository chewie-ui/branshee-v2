# Version de test sur un sous-domaine

But : faire tourner la v2 **avec une copie des vraies données** sur `v2.branshee.com` (par exemple),
à côté de l'ancien Branshee qui continue de fonctionner normalement, pour la montrer aux pros avant la bascule.

## Ce que la version de test ne fait jamais (`STAGING=1`)
- **Emails** : tous détournés vers une seule adresse (la tienne), sujet préfixé `[TEST → vrai-destinataire]`.
  Sans `SMTP_URL`, ils sont seulement visibles dans les logs.
- **SMS, WhatsApp, notifications push** : coupés.
- **Google Agenda** : aucune synchronisation (les agendas des pros ne reçoivent pas de doublons).
- **Moteurs de recherche** : `robots.txt` interdit tout ; un bandeau « Version de test » est affiché en haut des pages.
- **Paiements** : uniquement des clés Stripe **de test** dans `.env.production`.
- **Rappels automatiques** : n'ajoute pas de crontab pour la version de test.

## 1. Le sous-domaine (OVH, 2 minutes)
Espace client OVH › Noms de domaine › branshee.com › Zone DNS › Ajouter une entrée :
type **A**, sous-domaine **v2**, cible **l'adresse IP du VPS**. Attendre quelques minutes.

## 2. Installer la v2 sur le VPS
Connecte-toi au VPS en SSH, puis :
```bash
git clone https://github.com/chewie-ui/branshee-v2.git /tmp/branshee-v2-setup
bash /tmp/branshee-v2-setup/deploy/staging.sh v2.branshee.com ton.adresse@email.com
```
Le premier lancement crée la base `branshee_staging` et le fichier `/var/www/branshee-v2/.env.production`,
puis s'arrête pour que tu complètes `SMTP_URL` (le même que l'ancien Branshee). Ensuite relance :
```bash
bash /var/www/branshee-v2/deploy/staging.sh v2.branshee.com ton.adresse@email.com
```
Il installe, construit, démarre l'app (pm2, port 3001) et configure Nginx + HTTPS.
L'ancien Branshee n'est pas touché (autre dossier, autre port, autre base).

## 3. Copier les vraies données (une fois, puis quand tu veux rafraîchir)
Les données restent sur le VPS : rien n'est envoyé ailleurs. L'ancienne base MongoDB est seulement lue.
```bash
cd /var/www/branshee-v2
set -a; . ./.env.production; set +a
export MONGO_URI="…"                       # la même valeur que dans le .env de l'ancien Branshee
# Photos et PDF des dossiers de l'ancien Branshee (copie, l'original reste en place)
mkdir -p "$STORAGE_DIR/legacy-public" "$STORAGE_DIR/legacy-private"
cp -r /chemin/ancien-branshee/public/uploads/.  "$STORAGE_DIR/legacy-public/"
cp -r /chemin/ancien-branshee/private_uploads/. "$STORAGE_DIR/legacy-private/"
npm run migrate:mongo -- --dry-run          # essai à blanc : lis migration-report.json
npm run migrate:mongo                       # copie réelle (rejouer plus tard : --force)
pm2 restart branshee-staging
```
Tout le monde se connecte avec **son mot de passe habituel** (les anciens mots de passe sont acceptés).

## 4. Tester
- Toi : connexion, agenda, fiche d'un client, dossier, création / déplacement / annulation d'un RDV.
- Les emails arrivent tous dans ta boîte, avec le vrai destinataire dans le sujet : vérifie le contenu.
- Montre à ta kiné **son vrai compte** sur `https://v2.branshee.com` : elle se connecte comme d'habitude.
  Prévenir : ce qu'elle modifie sur la version de test **n'existe pas** dans le vrai Branshee.

## Mettre à jour la version de test
```bash
bash /var/www/branshee-v2/deploy/staging.sh v2.branshee.com ton.adresse@email.com
```

## Le jour de la bascule (plus tard)
Nouvelle installation de production (sans `STAGING`), migration finale, puis branshee.com pointé vers la v2 :
voir `docs/DEPLOY.md`. Les liens déjà envoyés aux patients (gérer / annuler un RDV, page de réservation) restent valides.

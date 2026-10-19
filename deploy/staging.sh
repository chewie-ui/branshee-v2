#!/usr/bin/env bash
# ── Branshee v2 : version de test sur un sous-domaine ─────────────────────
# À lancer sur le VPS (Ubuntu/Debian), avec un utilisateur qui a sudo :
#   bash deploy/staging.sh v2.branshee.com toi@exemple.com
#  1er argument : le sous-domaine (son enregistrement DNS A doit déjà pointer vers ce VPS)
#  2e argument  : l'adresse qui reçoit TOUS les emails de la version de test
#
# Relançable sans risque : il met à jour le code, la base et redémarre l'app.
# L'ancien Branshee n'est pas touché (autre dossier, autre port, autre base).
set -euo pipefail

DOMAIN="${1:?Indique le sous-domaine, ex. v2.branshee.com}"
TEST_EMAIL="${2:?Indique l’adresse qui recevra les emails de test}"
APP_DIR="${APP_DIR:-/var/www/branshee-v2}"
PORT="${PORT:-3050}"
DB_NAME="branshee_staging"
DB_USER="branshee_staging"
REPO="${REPO:-https://github.com/chewie-ui/branshee-v2.git}"

step() { printf "\n\033[1m▶ %s\033[0m\n" "$1"; }
need() { command -v "$1" >/dev/null 2>&1; }

step "Vérification des outils"
need node || { echo "Node.js manquant : curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs"; exit 1; }
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || { echo "Node.js 20 ou plus requis (installé : $(node -v))."; exit 1; }
need psql || { echo "PostgreSQL manquant : sudo apt install -y postgresql"; exit 1; }
need nginx || { echo "Nginx manquant : sudo apt install -y nginx"; exit 1; }
need pm2 || sudo npm install -g pm2
need certbot || sudo apt install -y certbot python3-certbot-nginx

step "Code (${APP_DIR})"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  sudo mkdir -p "$APP_DIR" && sudo chown "$USER" "$APP_DIR"
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

ENV_FILE="$APP_DIR/.env.production"
if [ ! -f "$ENV_FILE" ]; then
  step "Création de la base et du fichier d'environnement"
  DB_PASS="$(openssl rand -hex 16)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}'; ELSE ALTER ROLE ${DB_USER} PASSWORD '${DB_PASS}'; END IF;
END \$\$;
SQL
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  cat > "$ENV_FILE" <<ENV
# Version de test — rien ne part vers les vrais clients (voir docs/STAGING.md)
STAGING=1
STAGING_EMAIL_TO=${TEST_EMAIL}
NODE_ENV=production
PORT=${PORT}
APP_URL=https://${DOMAIN}
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
DATA_ENCRYPTION_KEY=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)
STORAGE_DIR=${APP_DIR}/storage
# Emails : mets ici le même SMTP que l'ancien Branshee (tout sera détourné vers ${TEST_EMAIL})
SMTP_URL=
MAIL_FROM="Branshee (test) <no-reply@branshee.com>"
# Stripe : clés de TEST uniquement (sk_test_… / pk_test_…), jamais les clés live ici
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
ENV
  chmod 600 "$ENV_FILE"
  echo "→ ${ENV_FILE} créé. Complète SMTP_URL (et les clés Stripe de test) puis relance ce script."
  exit 0
fi

set -a; . "$ENV_FILE"; set +a
grep -q '^STAGING=1' "$ENV_FILE" || { echo "STAGING=1 absent de ${ENV_FILE} : refus de continuer (sécurité)."; exit 1; }

step "Dépendances, base de données, construction"
npm ci --include=dev --no-audit --no-fund
npm run db:migrate
npm run build

step "Démarrage (pm2, port ${PORT})"
if pm2 describe branshee-staging >/dev/null 2>&1; then
  pm2 restart branshee-staging --update-env
else
  pm2 start npm --name branshee-staging -- start -- -p "$PORT" -H 127.0.0.1
fi
pm2 save >/dev/null

step "Nginx + HTTPS (${DOMAIN})"
SITE="/etc/nginx/sites-available/branshee-staging"
if [ ! -f "$SITE" ]; then
  sudo tee "$SITE" >/dev/null <<NGINX
server {
  listen 80;
  server_name ${DOMAIN};
  client_max_body_size 20m;
  location / {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
NGINX
  sudo ln -sf "$SITE" /etc/nginx/sites-enabled/branshee-staging
  sudo nginx -t && sudo systemctl reload nginx
fi
# Certificat HTTPS (réessayé à chaque lancement tant qu'il n'existe pas : il faut que le DNS pointe déjà vers ce VPS)
if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$TEST_EMAIL" --redirect || echo "⚠ HTTPS pas encore actif : vérifie l'entrée DNS de ${DOMAIN}, attends quelques minutes et relance ce script."
fi

step "Terminé"
echo "Version de test : https://${DOMAIN}"
echo "Étape suivante (une fois) : copier les données de l'ancien Branshee → voir docs/STAGING.md, « Copier les vraies données »."

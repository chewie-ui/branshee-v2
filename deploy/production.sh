#!/usr/bin/env bash
# ── Branshee v2 : mise en production sur branshee.com ─────────────────────
# À lancer sur le VPS avec l'utilisateur qui fait tourner les apps (sudo nécessaire pour Nginx) :
#
#   bash deploy/production.sh prepare    # 1) prépare tout SANS rien couper (code, base vide, config, build)
#   bash deploy/production.sh cutover    # 2) la bascule : ~5 min de maintenance, migration finale, branshee.com → v2
#   bash deploy/production.sh rollback   # en cas de souci : branshee.com repasse sur l'ancien Branshee
#   bash deploy/production.sh update     # après la bascule : met à jour le code de production
#
# L'ancien Branshee n'est jamais supprimé : son dossier, sa base MongoDB et sa config restent en place.
# Aucun secret n'est affiché : ils sont lus dans l'ancien .env et la config de test, puis écrits dans un fichier en 600.
set -euo pipefail

CMD="${1:-}"
PROD_DIR="/var/www/branshee-prod"
STAGING_DIR="/var/www/branshee-v2"
OLD_DIR="/var/www/branshee.com"
OLD_ENV="$OLD_DIR/.env"
PORT=3060
DB_NAME="branshee_prod"
DB_USER="branshee_prod"
REPO="https://github.com/chewie-ui/branshee-v2.git"
NGINX_SITE="/etc/nginx/sites-enabled/branshee.com"
NGINX_BACKUP="/etc/nginx/branshee.com.ancien-branshee"
BACKUP_DIR="/var/backups/branshee"
ENV_FILE="$PROD_DIR/.env.production"

step() { printf "\n\033[1m▶ %s\033[0m\n" "$1"; }
die() { printf "\033[31m✖ %s\033[0m\n" "$1"; exit 1; }
# Lit une variable d'un fichier .env sans l'afficher ni exécuter le fichier.
envget() { grep -E "^$2=" "$1" 2>/dev/null | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'; }

prepare() {
  step "Code de production (${PROD_DIR})"
  if [ -d "$PROD_DIR/.git" ]; then git -C "$PROD_DIR" pull --ff-only; else sudo mkdir -p "$PROD_DIR" && sudo chown "$USER" "$PROD_DIR" && git clone "$REPO" "$PROD_DIR"; fi
  cd "$PROD_DIR"

  if [ ! -f "$ENV_FILE" ]; then
    step "Base de données de production et configuration"
    [ -f "$OLD_ENV" ] || die "Ancien .env introuvable ($OLD_ENV)."
    DB_PASS="$(openssl rand -hex 16)"
    sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}'; ELSE ALTER ROLE ${DB_USER} PASSWORD '${DB_PASS}'; END IF;
END \$\$;
SQL
    sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
    S="$STAGING_DIR/.env.production"
    umask 077
    cat > "$ENV_FILE" <<ENV
# Branshee — PRODUCTION (branshee.com). Ne jamais committer. Sauvegarder DATA_ENCRYPTION_KEY à part.
NODE_ENV=production
PORT=${PORT}
APP_URL=https://branshee.com
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
DATA_ENCRYPTION_KEY=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)
STORAGE_DIR=${PROD_DIR}/storage
SMTP_URL=$(envget "$S" SMTP_URL)
MAIL_FROM="Branshee <no-reply@branshee.com>"
GOOGLE_CLIENT_ID=$(envget "$S" GOOGLE_CLIENT_ID)
GOOGLE_CLIENT_SECRET=$(envget "$S" GOOGLE_CLIENT_SECRET)
STRIPE_SECRET_KEY=$(envget "$OLD_ENV" STRIPE_SECRET_KEY_SERVER)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$(envget "$OLD_ENV" STRIPE_PUBLISHABLE_KEY_SERVER)
STRIPE_WEBHOOK_SECRET=$(envget "$OLD_ENV" STRIPE_WEBHOOK_KEY_SERVER)
STRIPE_PRICE_PRO_MONTHLY=$(envget "$OLD_ENV" STRIPE_PRICE_PREMIUM_MONTHLY_KEY_SERVER)
STRIPE_PRICE_PRO_YEARLY=$(envget "$OLD_ENV" STRIPE_PRICE_PREMIUM_YEARLY_KEY_SERVER)
STRIPE_PRICE_PROPLUS_MONTHLY=$(envget "$OLD_ENV" STRIPE_PRICE_BUSINESS_MONTHLY_KEY_SERVER)
STRIPE_PRICE_PROPLUS_YEARLY=$(envget "$OLD_ENV" STRIPE_PRICE_BUSINESS_YEARLY_KEY_SERVER)
STRIPE_PRICE_CUSTOM_URL=$(envget "$OLD_ENV" STRIPE_PRICE_ADDON_CUSTOM_URL_SERVER)
STRIPE_PRICE_EXTRA_SEAT=$(envget "$OLD_ENV" STRIPE_PRICE_EXTRA_COLLABORATOR_SERVER)
SUPPORT_EMAIL=$(envget "$OLD_ENV" ADMIN_EMAIL)
# SMS (Twilio) : ajoutés par « bash deploy/production.sh twilio »
SMS_PROVIDER=twilio
SMS_SENDER=Branshee
ENV
    chmod 600 "$ENV_FILE"
    umask 022
  fi

  step "Vérification de la configuration (sans afficher les secrets)"
  for k in DATABASE_URL SMTP_URL STRIPE_SECRET_KEY NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_PRO_MONTHLY STRIPE_PRICE_PROPLUS_MONTHLY GOOGLE_CLIENT_ID; do
    [ -n "$(envget "$ENV_FILE" "$k")" ] && echo "  ✔ $k" || echo "  ✖ $k manquant"
  done
  [ -n "$(envget "$ENV_FILE" TWILIO_ACCOUNT_SID)" ] && echo "  ✔ Twilio" || echo "  … Twilio pas encore ajouté (SMS désactivés, l'email prend le relais)"
  grep -q '^STAGING=' "$ENV_FILE" && die "STAGING présent dans la config de production."

  step "Dépendances, base, construction"
  set -a; . "$ENV_FILE"; set +a
  npm ci --include=dev --no-audit --no-fund
  npm run db:migrate
  npm run build
  mkdir -p "$PROD_DIR/storage/legacy-public" "$PROD_DIR/storage/legacy-private"
  echo; echo "✔ Production prête (rien n'est encore coupé). Le jour J : bash deploy/production.sh cutover"
}

twilio() {
  [ -f "$ENV_FILE" ] || die "Lance d'abord : bash deploy/production.sh prepare"
  read -r -p "Account SID (AC…) : " A
  read -r -s -p "Auth Token : " T; echo
  [[ "$A" == AC* ]] || die "Le SID doit commencer par AC."
  sed -i '/^TWILIO_ACCOUNT_SID=/d;/^TWILIO_AUTH_TOKEN=/d' "$ENV_FILE"
  printf 'TWILIO_ACCOUNT_SID=%s\nTWILIO_AUTH_TOKEN=%s\n' "$A" "$T" >> "$ENV_FILE"
  echo "✔ Clés Twilio enregistrées. (Si la production tourne déjà : pm2 restart branshee-v2 --update-env)"
}

cutover() {
  [ -f "$ENV_FILE" ] || die "Lance d'abord : bash deploy/production.sh prepare"
  [ -d "$PROD_DIR/.next" ] || die "Build absent : relance prepare."
  MONGO="$(envget "$OLD_ENV" MONGO_URI_SERVER)"; [ -n "$MONGO" ] || MONGO="$(envget "$OLD_ENV" MONGO_URI)"
  [ -n "$MONGO" ] || die "MONGO_URI introuvable dans l'ancien .env."
  set -a; . "$ENV_FILE"; set +a
  cd "$PROD_DIR"

  step "1/8 Sauvegarde de la config Nginx actuelle"
  [ -f "$NGINX_BACKUP" ] || sudo cp "$NGINX_SITE" "$NGINX_BACKUP"

  step "2/8 Page de maintenance sur branshee.com"
  sudo mkdir -p /var/www/branshee-maintenance
  sudo tee /var/www/branshee-maintenance/index.html >/dev/null <<'HTML'
<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Branshee — mise à jour</title>
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f6f6f7;color:#18181b"><main style="text-align:center;padding:24px"><h1 style="font-size:24px">Branshee se met à jour</h1><p>Le site revient dans quelques minutes. Merci de votre patience.</p></main></body></html>
HTML
  sudo sed -i -E 's#proxy_pass http://(localhost|127\.0\.0\.1):[0-9]+;#root /var/www/branshee-maintenance; try_files /index.html =503;#' "$NGINX_SITE"
  sudo nginx -t && sudo systemctl reload nginx

  step "3/8 Arrêt de l'ancien Branshee (ses données ne bougent plus)"
  pm2 stop branshee || true

  step "4/8 Copie des photos de l'ancien Branshee"
  rsync -a "$OLD_DIR/public/uploads/" "$PROD_DIR/storage/legacy-public/" 2>/dev/null || true
  [ -d "$OLD_DIR/private_uploads" ] && rsync -a "$OLD_DIR/private_uploads/" "$PROD_DIR/storage/legacy-private/" || true

  step "5/8 Migration finale des données"
  MONGO_URI="$MONGO" npm run migrate:mongo -- --force

  step "6/8 Démarrage de la nouvelle version"
  pm2 delete branshee-v2 >/dev/null 2>&1 || true
  pm2 start npm --name branshee-v2 --cwd "$PROD_DIR" -- start -- -p "$PORT" -H 127.0.0.1
  for i in $(seq 1 30); do curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/connexion" && break; sleep 2; done
  curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/connexion" || { echo "La v2 ne répond pas : retour à l'ancien Branshee."; rollback; exit 1; }
  pm2 save

  step "7/8 branshee.com → nouvelle version"
  sudo cp "$NGINX_BACKUP" "$NGINX_SITE"
  sudo sed -i -E "s#proxy_pass http://(localhost|127\.0\.0\.1):[0-9]+;#proxy_pass http://127.0.0.1:${PORT};#" "$NGINX_SITE"
  grep -q 'proxy_set_header Host' "$NGINX_SITE" || sudo sed -i -E "s#(proxy_pass http://127\.0\.0\.1:${PORT};)#\1\n        proxy_set_header Host \$host;\n        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \$scheme;#" "$NGINX_SITE"
  grep -q client_max_body_size "$NGINX_SITE" || sudo sed -i -E "0,/server_name branshee.com www.branshee.com;/s//server_name branshee.com www.branshee.com;\n    client_max_body_size 12m;/" "$NGINX_SITE"
  sudo nginx -t && sudo systemctl reload nginx

  step "8/8 Tâches planifiées, sauvegardes, Stripe"
  sudo mkdir -p "$BACKUP_DIR" && sudo chown "$USER" "$BACKUP_DIR"
  ( crontab -l 2>/dev/null | grep -v 'branshee-v2-prod' || true
    echo "*/15 * * * * curl -fsS -X POST -H 'Authorization: Bearer ${CRON_SECRET}' https://branshee.com/api/cron/reminders > /dev/null # branshee-v2-prod"
    echo "0 10 * * * curl -fsS -X POST -H 'Authorization: Bearer ${CRON_SECRET}' https://branshee.com/api/cron/daily > /dev/null # branshee-v2-prod"
    echo "0 3 * * * pg_dump '${DATABASE_URL}' | gzip > ${BACKUP_DIR}/\$(date +\\%F).sql.gz && find ${BACKUP_DIR} -name '*.sql.gz' -mtime +14 -delete # branshee-v2-prod"
  ) | crontab -
  # Le webhook Stripe existant (www.branshee.com/account/webhook) est servi par la v2 : on y ajoute les événements d'abonnement.
  node -e '
    const S = require("stripe"); const s = new S(process.env.STRIPE_SECRET_KEY);
    (async () => {
      const list = await s.webhookEndpoints.list({ limit: 20 });
      const ep = list.data.find((w) => /branshee\.com\/account\/webhook$/.test(w.url));
      if (!ep) return console.log("  … webhook Stripe introuvable : à créer dans Stripe (https://branshee.com/api/stripe/webhook)");
      const need = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed"];
      const events = [...new Set([...ep.enabled_events, ...need])];
      await s.webhookEndpoints.update(ep.id, { enabled_events: events });
      console.log("  ✔ Webhook Stripe : " + events.length + " événements");
    })().catch((e) => console.log("  ✖ Stripe : " + e.message));
  '
  # La version de test ne sert plus (ses données seraient trompeuses) : on l’arrête.
  pm2 stop branshee-staging >/dev/null 2>&1 || true
  pm2 save
  echo; echo "✔ Bascule terminée : https://branshee.com tourne sur la nouvelle version."
  echo "  Retour arrière possible à tout moment : bash deploy/production.sh rollback"
}

rollback() {
  step "Retour à l'ancien Branshee"
  [ -f "$NGINX_BACKUP" ] && sudo cp "$NGINX_BACKUP" "$NGINX_SITE"
  sudo nginx -t && sudo systemctl reload nginx
  pm2 start branshee >/dev/null 2>&1 || pm2 restart branshee
  pm2 stop branshee-v2 >/dev/null 2>&1 || true
  ( crontab -l 2>/dev/null | grep -v 'branshee-v2-prod' || true ) | crontab -
  pm2 save
  echo "✔ branshee.com tourne de nouveau sur l'ancien Branshee."
}

update() {
  [ -f "$ENV_FILE" ] || die "Production non préparée."
  cd "$PROD_DIR" && git pull --ff-only
  set -a; . "$ENV_FILE"; set +a
  npm ci --include=dev --no-audit --no-fund && npm run db:migrate && npm run build
  pm2 restart branshee-v2 --update-env && pm2 save
  echo "✔ Production à jour."
}

case "$CMD" in
  prepare) prepare ;;
  twilio) twilio ;;
  cutover) cutover ;;
  rollback) rollback ;;
  update) update ;;
  *) echo "Usage : bash deploy/production.sh prepare | twilio | cutover | rollback | update"; exit 1 ;;
esac

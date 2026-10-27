#!/usr/bin/env bash
# ── Skydev : mise en ligne sur skydev.be, à côté de Branshee (sans y toucher) ─────────────
# À lancer sur le VPS avec l'utilisateur qui fait tourner les apps (sudo nécessaire pour Nginx/Certbot) :
#
#   bash skydev.sh setup     # 1) code (branche skydev-plateforme), base à part, config, construction, démarrage sur le port 3070
#   bash skydev.sh nginx     # 2) site Nginx skydev.be (HTTP) — après avoir pointé le DNS vers le VPS
#   bash skydev.sh https     # 3) certificat HTTPS (Let's Encrypt) pour skydev.be, www et client
#   bash skydev.sh update    # ensuite : met à jour Skydev
#
# Séparé de Branshee en tout : dossier /var/www/skydev, base « skydev », processus pm2 « skydev », port 3070.
# La seule pièce commune est Nginx : on AJOUTE un fichier de site, la config est testée avant tout rechargement,
# et rien n'est rechargé si le test échoue. Aucun secret n'est affiché.
set -euo pipefail

CMD="${1:-}"
DIR="/var/www/skydev"
BRANCH="skydev-plateforme"
PORT=3070
DB_NAME="skydev"
DB_USER="skydev"
REPO="https://github.com/chewie-ui/branshee-v2.git"
ENV_FILE="$DIR/.env.production"
BRANSHEE_ENV="/var/www/branshee-prod/.env.production"
NGINX_SITE="/etc/nginx/sites-available/skydev.be"
DOMAINS=(skydev.be www.skydev.be client.skydev.be)

step() { printf "\n\033[1m▶ %s\033[0m\n" "$1"; }
die() { printf "\033[31m✖ %s\033[0m\n" "$1"; exit 1; }
envget() { grep -E "^$2=" "$1" 2>/dev/null | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'; }

setup() {
  ss -ltn | grep -q ":${PORT} " && ! pm2 describe skydev >/dev/null 2>&1 && die "Le port ${PORT} est déjà utilisé par une autre app."

  step "Code Skydev (${DIR}, branche ${BRANCH})"
  if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" pull -q --ff-only origin "$BRANCH"
  else sudo mkdir -p "$DIR" && sudo chown "$USER" "$DIR" && git clone -q --branch "$BRANCH" "$REPO" "$DIR"; fi
  cd "$DIR"

  if [ ! -f "$ENV_FILE" ]; then
    step "Base de données Skydev (séparée de Branshee) et configuration"
    DB_PASS="$(openssl rand -hex 16)"
    sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}'; ELSE ALTER ROLE ${DB_USER} PASSWORD '${DB_PASS}'; END IF;
END \$\$;
SQL
    sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
    umask 077
    cat > "$ENV_FILE" <<ENV
# Skydev — skydev.be. Ne jamais committer. Sauvegarder DATA_ENCRYPTION_KEY à part.
NODE_ENV=production
PORT=${PORT}
APP_URL=https://skydev.be
SKYDEV_APP_URL=https://skydev.be
FORCE_BRAND=skydev
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
DATA_ENCRYPTION_KEY=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)
STORAGE_DIR=${DIR}/storage
SMTP_URL=$(envget "$BRANSHEE_ENV" SMTP_URL)
BREVO_API_KEY=$(envget "$BRANSHEE_ENV" BREVO_API_KEY)
MAIL_FROM="Skydev <no-reply@branshee.com>"
MAIL_FROM_SKYDEV="Skydev <no-reply@branshee.com>"
SUPPORT_EMAIL=info@skydev.be
SKYDEV_CONTACT_EMAIL=info@skydev.be
# Paiement Skydev : pas encore branché (les clés et les prix Stripe Skydev viendront plus tard).
ENV
    chmod 600 "$ENV_FILE"
    umask 022
  fi

  step "Dépendances, base, construction (Branshee continue de tourner)"
  set -a; . "$ENV_FILE"; set +a
  npm ci --include=dev --no-audit --no-fund
  npm run db:migrate
  nice -n 10 npm run build
  mkdir -p "$DIR/storage"

  step "Démarrage (pm2 « skydev », port ${PORT})"
  pm2 delete skydev >/dev/null 2>&1 || true
  pm2 start npm --name skydev --cwd "$DIR" -- start -- -p "$PORT" -H 127.0.0.1
  pm2 save
  sleep 5
  curl -fsS -o /dev/null -H "Host: skydev.be" "http://127.0.0.1:${PORT}/" && echo "  ✔ Skydev répond en local" || die "Skydev ne répond pas : pm2 logs skydev"

  step "Tâches planifiées Skydev (rappels, quotidien)"
  ( crontab -l 2>/dev/null | grep -v '# skydev' || true
    echo "*/15 * * * * curl -fsS -X POST -H 'Authorization: Bearer ${CRON_SECRET}' http://127.0.0.1:${PORT}/api/cron/reminders > /dev/null # skydev"
    echo "5 10 * * * curl -fsS -X POST -H 'Authorization: Bearer ${CRON_SECRET}' http://127.0.0.1:${PORT}/api/cron/daily > /dev/null # skydev"
    echo "30 3 * * * umask 077; mkdir -p ${DIR}/backups; pg_dump '${DATABASE_URL}' | gzip > ${DIR}/backups/\$(date +\\%F).sql.gz && find ${DIR}/backups -name '*.sql.gz' -mtime +14 -delete # skydev"
  ) | crontab -
  echo; echo "✔ Skydev prêt sur le port ${PORT}. Étape suivante : pointer le DNS, puis bash skydev.sh nginx"
}

nginx_site() {
  step "Vérification du DNS"
  IP="$(curl -fsS -4 ifconfig.me 2>/dev/null || true)"
  for d in "${DOMAINS[@]}"; do
    got="$(dig +short A "$d" | tail -1)"
    [ "$got" = "$IP" ] && echo "  ✔ $d → $got" || echo "  … $d → ${got:-rien} (attendu : $IP). Le DNS n'est peut-être pas encore propagé."
  done

  step "Site Nginx skydev.be (ajout d'un fichier, Branshee intact)"
  sudo tee "$NGINX_SITE" >/dev/null <<NGINX
# Skydev — proxy vers l'app Node (pm2 « skydev », port ${PORT}). Fichier ajouté par deploy/skydev.sh.
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAINS[*]};
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
  sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/skydev.be
  if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "  ✔ Nginx rechargé"
  else
    sudo rm -f /etc/nginx/sites-enabled/skydev.be
    die "Config Nginx invalide : le site skydev.be a été retiré, rien n'a été rechargé (Branshee intact)."
  fi
  curl -fsS -o /dev/null https://branshee.com/ && echo "  ✔ branshee.com répond toujours" || echo "  ⚠ branshee.com ne répond pas : vérifier tout de suite"
  echo; echo "✔ Site en place. Dernière étape : bash skydev.sh https"
}

https_cert() {
  step "Certificat HTTPS pour ${DOMAINS[*]}"
  args=(); for d in "${DOMAINS[@]}"; do args+=(-d "$d"); done
  sudo certbot --nginx --cert-name skydev.be "${args[@]}" --redirect --non-interactive --agree-tos -m info@skydev.be
  sudo nginx -t && sudo systemctl reload nginx
  curl -fsS -o /dev/null https://skydev.be/ && echo "  ✔ https://skydev.be répond" || echo "  … https://skydev.be ne répond pas encore"
  curl -fsS -o /dev/null https://branshee.com/ && echo "  ✔ branshee.com répond toujours" || echo "  ⚠ branshee.com ne répond pas : vérifier tout de suite"
}

update() {
  [ -f "$ENV_FILE" ] || die "Skydev pas encore installé : bash skydev.sh setup"
  cd "$DIR" && git pull -q --ff-only origin "$BRANCH"
  set -a; . "$ENV_FILE"; set +a
  npm ci --include=dev --no-audit --no-fund && npm run db:migrate && nice -n 10 npm run build
  pm2 restart skydev --update-env && pm2 save
  echo "✔ Skydev à jour."
}

case "$CMD" in
  setup) setup ;;
  nginx) nginx_site ;;
  https) https_cert ;;
  update) update ;;
  *) echo "Usage : bash skydev.sh setup | nginx | https | update"; exit 1 ;;
esac

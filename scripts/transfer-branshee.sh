#!/usr/bin/env bash
# Transfert Branshee → Skydev, sur le VPS.  Usage :  bash scripts/transfer-branshee.sh essai|reel
#
#   essai : tout est simulé dans Skydev puis annulé ; seuls des nombres s'affichent.
#   reel  : sauvegarde des deux bases, transfert, copie des fichiers, ajout des prix Stripe Branshee à Skydev.
#
# Aucune clé, adresse de base ni donnée n'est affichée : les valeurs sont lues dans les fichiers .env des deux sites.
set -euo pipefail
MODE="${1:-essai}"
[ "$MODE" = "essai" ] || [ "$MODE" = "reel" ] || { echo "Usage : $0 essai|reel"; exit 2; }

BRANSHEE_DIR="${BRANSHEE_DIR:-/var/www/branshee-prod}"
SKYDEV_DIR="${SKYDEV_DIR:-/var/www/skydev}"
envfile() { for f in "$1/.env.production" "$1/.env"; do [ -f "$f" ] && { echo "$f"; return; }; done; echo "Pas de fichier .env dans $1" >&2; exit 2; }
val() { grep -E "^$2=" "$1" | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }
storage() { local s; s=$(val "$1" STORAGE_DIR || true); s="${s:-storage}"; case "$s" in /*) echo "$s";; *) echo "$2/$s";; esac; }

BE=$(envfile "$BRANSHEE_DIR"); SE=$(envfile "$SKYDEV_DIR")
export SRC_DATABASE_URL="$(val "$BE" DATABASE_URL)" DST_DATABASE_URL="$(val "$SE" DATABASE_URL)"
export SRC_KEY="$(val "$BE" DATA_ENCRYPTION_KEY)" DST_KEY="$(val "$SE" DATA_ENCRYPTION_KEY)"
export SRC_STORAGE="$(storage "$BE" "$BRANSHEE_DIR")" DST_STORAGE="$(storage "$SE" "$SKYDEV_DIR")" MODE
[ -n "$SRC_DATABASE_URL" ] && [ -n "$DST_DATABASE_URL" ] && [ -n "$SRC_KEY" ] && [ -n "$DST_KEY" ] || { echo "Variables manquantes dans un des .env"; exit 2; }
[ "$SRC_DATABASE_URL" != "$DST_DATABASE_URL" ] || { echo "Les deux sites pointent vers la même base : arrêt."; exit 2; }

if [ "$MODE" = "reel" ]; then
  T=$(date +%Y%m%d-%H%M); mkdir -p ~/backups/skydev ~/backups/branshee
  pg_dump "$DST_DATABASE_URL" > ~/backups/skydev/avant-transfert-$T.sql && chmod 600 ~/backups/skydev/avant-transfert-$T.sql
  pg_dump "$SRC_DATABASE_URL" > ~/backups/branshee/avant-transfert-$T.sql && chmod 600 ~/backups/branshee/avant-transfert-$T.sql
  echo "Sauvegardes : ~/backups/skydev/avant-transfert-$T.sql et ~/backups/branshee/avant-transfert-$T.sql"
fi

cd "$SKYDEV_DIR" && node scripts/transfer-branshee.mjs

if [ "$MODE" = "reel" ]; then
  # Prix Stripe de Branshee (Pro, Pro+, options) : Skydev doit reconnaître les abonnements des kinés.
  cp "$SE" "$SE.avant-transfert-$T" && chmod 600 "$SE.avant-transfert-$T"
  added=0
  for k in STRIPE_PRICE_PRO_MONTHLY STRIPE_PRICE_PRO_YEARLY STRIPE_PRICE_PROPLUS_MONTHLY STRIPE_PRICE_PROPLUS_YEARLY STRIPE_PRICE_EXTRA_SEAT STRIPE_PRICE_CUSTOM_URL; do
    if ! grep -qE "^$k=.+" "$SE" && grep -qE "^$k=.+" "$BE"; then grep -E "^$k=" "$BE" | tail -1 >> "$SE"; added=$((added + 1)); fi
  done
  echo "Prix Stripe Branshee ajoutés à Skydev : $added"
  [ "$added" -gt 0 ] && echo "→ Redémarrer Skydev : pm2 restart skydev --update-env"
fi

#!/usr/bin/env bash
# Active Stripe en mode TEST sur la version de test (v2.branshee.com).
# Usage (sur le serveur) : cd /var/www/branshee-v2 && bash deploy/stripe-test.sh
# - demande les clés de test sans les afficher (refuse les clés live) ;
# - crée dans Stripe (mode test) les prix des forfaits et le webhook de la v2 ;
# - écrit tout dans .env.production puis reconstruit et redémarre la v2.
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=".env.production"
[ -f "$ENV_FILE" ] || { echo "✖ $ENV_FILE introuvable : lance ce script dans /var/www/branshee-v2"; exit 1; }
grep -q '^STAGING=1' "$ENV_FILE" || { echo "✖ Ce n'est pas la version de test : refus."; exit 1; }
DOMAIN=$(grep -E '^APP_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed 's#https\?://##')

echo "Clés sur https://dashboard.stripe.com/test/apikeys (mode Test activé)."
read -rsp "Clé secrète de test (sk_test_…) : " SK; echo
read -rsp "Clé publiable de test (pk_test_…) : " PK; echo
[[ "$SK" == sk_test_* ]] || { echo "✖ La clé secrète doit commencer par sk_test_ (jamais une clé live ici)."; exit 1; }
[[ "$PK" == pk_test_* ]] || { echo "✖ La clé publiable doit commencer par pk_test_."; exit 1; }

OUT=$(mktemp); chmod 600 "$OUT"
SK="$SK" DOMAIN="$DOMAIN" OUT="$OUT" node -e '
  const S = require("stripe"); const s = new S(process.env.SK);
  const fs = require("fs");
  const want = [
    ["STRIPE_PRICE_PRO_MONTHLY", "Branshee Pro", 1900, "month"],
    ["STRIPE_PRICE_PRO_YEARLY", "Branshee Pro", 18000, "year"],
    ["STRIPE_PRICE_PROPLUS_MONTHLY", "Branshee Pro+", 4900, "month"],
    ["STRIPE_PRICE_PROPLUS_YEARLY", "Branshee Pro+", 46800, "year"],
    ["STRIPE_PRICE_CUSTOM_URL", "Adresse personnalisée", 500, "month"],
    ["STRIPE_PRICE_EXTRA_SEAT", "Membre d’équipe supplémentaire", 1000, "month"],
  ];
  (async () => {
    const lines = [];
    for (const [key, name, amount, interval] of want) {
      const lookup = "branshee_test_" + key.toLowerCase();
      const found = (await s.prices.list({ lookup_keys: [lookup], limit: 1 })).data[0];
      const price = found ?? await s.prices.create({ currency: "eur", unit_amount: amount, recurring: { interval }, lookup_key: lookup, product_data: { name } });
      lines.push(key + "=" + price.id);
      console.log("  ✔ " + name + " (" + amount / 100 + " €/" + (interval === "year" ? "an" : "mois") + ")");
    }
    const url = "https://" + process.env.DOMAIN + "/api/stripe/webhook";
    for (const w of (await s.webhookEndpoints.list({ limit: 100 })).data) if (w.url === url) await s.webhookEndpoints.del(w.id);
    const ep = await s.webhookEndpoints.create({ url, enabled_events: ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed"] });
    lines.push("STRIPE_WEBHOOK_SECRET=" + ep.secret);
    console.log("  ✔ Webhook : " + url);
    fs.writeFileSync(process.env.OUT, lines.join("\n") + "\n");
  })().catch((e) => { console.error("✖ Stripe : " + e.message); process.exit(1); });
'

sed -i '/^STRIPE_/d;/^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=/d' "$ENV_FILE"
{ printf 'STRIPE_SECRET_KEY=%s\nNEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=%s\n' "$SK" "$PK"; cat "$OUT"; } >> "$ENV_FILE"
rm -f "$OUT"; unset SK PK
chmod 600 "$ENV_FILE"
echo "✔ Clés de test enregistrées. Reconstruction de la v2 (2-3 minutes)…"
nohup bash deploy/staging.sh "$DOMAIN" "$(grep -E '^STAGING_EMAIL_TO=' "$ENV_FILE" | cut -d= -f2- || true)" > /tmp/deploy-v2.log 2>&1 &
echo "  Suivi : tail -f /tmp/deploy-v2.log"

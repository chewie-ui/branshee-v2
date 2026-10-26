#!/usr/bin/env bash
# Crée (ou retrouve) dans Stripe les prix TVAC des forfaits Branshee et Skydev et les écrit dans la config de l'app.
# Usage : bash deploy/stripe-prices.sh /var/www/branshee-prod     (ou le dossier de la version de test)
# Idempotent : relancé, il réutilise les prix existants (lookup_key). Aucun secret n'est affiché.
set -euo pipefail
DIR="${1:?Dossier de l’application, ex. /var/www/branshee-prod}"
ENV_FILE="$DIR/.env.production"
[ -f "$ENV_FILE" ] || { echo "✖ $ENV_FILE introuvable"; exit 1; }
OUT=$(mktemp); chmod 600 "$OUT"
cd "$DIR"
SK="$(grep -E "^STRIPE_SECRET_KEY=" "$ENV_FILE" | tail -1 | cut -d= -f2-)"
export SK OUT
node -e '
  const S = require("stripe"); const s = new S(process.env.SK);
  const fs = require("fs");
  // [variable, produit, montant TVAC en centimes, période]
  const want = [
    ["STRIPE_PRICE_PRO_MONTHLY", "Branshee Pro", 2300, "month"],
    ["STRIPE_PRICE_PRO_YEARLY", "Branshee Pro", 22000, "year"],
    ["STRIPE_PRICE_PROPLUS_MONTHLY", "Branshee Pro+", 5950, "month"],
    ["STRIPE_PRICE_PROPLUS_YEARLY", "Branshee Pro+", 57000, "year"],
    ["STRIPE_PRICE_CUSTOM_URL", "Branshee — URL personnalisée", 600, "month"],
    ["STRIPE_PRICE_EXTRA_SEAT", "Branshee — Siège collaborateur", 1200, "month"],
    // Offre Skydev (src/lib/skydev-plans.ts) : Solo, Équipe et options.
    ["STRIPE_PRICE_SKYDEV_SOLO_MONTHLY", "Skydev Solo", 2900, "month"],
    ["STRIPE_PRICE_SKYDEV_SOLO_YEARLY", "Skydev Solo", 29000, "year"],
    ["STRIPE_PRICE_SKYDEV_EQUIPE_MONTHLY", "Skydev Équipe", 5900, "month"],
    ["STRIPE_PRICE_SKYDEV_EQUIPE_YEARLY", "Skydev Équipe", 59000, "year"],
    ["STRIPE_PRICE_SKYDEV_DOMAIN", "Skydev — Nom de domaine", 600, "month"],
    ["STRIPE_PRICE_SKYDEV_SEAT", "Skydev — Utilisateur en plus", 1200, "month"],
    ["STRIPE_PRICE_MODULE_TEL_IA", "Skydev — Tél IA", 3900, "month"],
  ];
  (async () => {
    const products = {};
    const lines = [];
    for (const [key, name, amount, interval] of want) {
      const lookup = "branshee_ttc_" + key.toLowerCase().replace("stripe_price_", "");  // clé unique par prix (Skydev compris)
      let price = (await s.prices.list({ lookup_keys: [lookup], limit: 1 })).data[0];
      if (!price) {
        products[name] ??= (await s.products.search({ query: `metadata["branshee_name"]:"${name}"` })).data[0]?.id ?? (await s.products.create({ name, metadata: { branshee_name: name } })).id;
        price = await s.prices.create({ currency: "eur", unit_amount: amount, recurring: { interval }, tax_behavior: "inclusive", lookup_key: lookup, product: products[name] });
      }
      lines.push(key + "=" + price.id);
      console.log("  ✔ " + name + " : " + (price.unit_amount / 100).toFixed(2).replace(".", ",") + " € TVAC / " + (interval === "year" ? "an" : "mois") + (price.livemode ? "" : " (test)"));
    }
    fs.writeFileSync(process.env.OUT, lines.join("\n") + "\n");
  })().catch((e) => { console.error("✖ Stripe : " + e.message); process.exit(1); });
'
sed -i '/^STRIPE_PRICE_/d' "$ENV_FILE"
cat "$OUT" >> "$ENV_FILE"; rm -f "$OUT"; chmod 600 "$ENV_FILE"
echo "✔ Prix enregistrés dans $ENV_FILE (relancer l'app pour les prendre en compte)."

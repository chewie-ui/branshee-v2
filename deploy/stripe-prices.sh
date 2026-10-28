#!/usr/bin/env bash
# Crée (ou retrouve) dans Stripe les prix TVAC des forfaits Branshee et Skydev et les écrit dans la config de l'app.
# Usage : bash deploy/stripe-prices.sh /var/www/branshee-prod     (ou le dossier de la version de test)
#         ONLY=skydev bash deploy/stripe-prices.sh /var/www/skydev   (prix Skydev seulement : rien n'est créé ni modifié pour Branshee)
# Idempotent : relancé, il réutilise les prix existants (lookup_key). Aucun secret n'est affiché.
set -euo pipefail
DIR="${1:?Dossier de l’application, ex. /var/www/branshee-prod}"
ENV_FILE="$DIR/.env.production"
[ -f "$ENV_FILE" ] || { echo "✖ $ENV_FILE introuvable"; exit 1; }
OUT=$(mktemp); chmod 600 "$OUT"
cd "$DIR"
SK="$(grep -E "^STRIPE_SECRET_KEY=" "$ENV_FILE" | tail -1 | cut -d= -f2-)"
ONLY="${ONLY:-}"
export SK OUT ONLY
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
    // Offre Skydev (src/lib/skydev-plans.ts) : un abonnement par utilisateur, prix dégressif (montant = tableau de paliers).
    // Annuel = 10 mois. Une fois créé, un prix Stripe ne change plus : nouveaux paliers = nouvelle clé (suffixe _v2…).
    ["STRIPE_PRICE_SKYDEV_MONTHLY", "Skydev", [2900, 2500, 2200, 2000, 1800, 1600, 1500], "month"],
    ["STRIPE_PRICE_SKYDEV_YEARLY", "Skydev", [29000, 25000, 22000, 20000, 18000, 16000, 15000], "year"],
    ["STRIPE_PRICE_SKYDEV_DOMAIN", "Skydev — Nom de domaine", 600, "month"],
    ["STRIPE_PRICE_MODULE_TEL_IA", "Skydev — Tél IA", 3900, "month"],
  ];
  (async () => {
    const products = {};
    const lines = [];
    const keep = process.env.ONLY === "skydev" ? want.filter(([k]) => /SKYDEV|MODULE/.test(k)) : want;
    for (const [key, name, amount, interval] of keep) {
      const lookup = "branshee_ttc_" + key.toLowerCase().replace("stripe_price_", "");  // clé unique par prix (Skydev compris)
      let price = (await s.prices.list({ lookup_keys: [lookup], limit: 1 })).data[0];
      if (!price) {
        products[name] ??= (await s.products.search({ query: `metadata["branshee_name"]:"${name}"` })).data[0]?.id ?? (await s.products.create({ name, metadata: { branshee_name: name } })).id;
        price = Array.isArray(amount)
          ? await s.prices.create({ currency: "eur", billing_scheme: "tiered", tiers_mode: "graduated", tiers: amount.map((a, i) => ({ up_to: i === amount.length - 1 ? "inf" : i + 1, unit_amount: a })), recurring: { interval, usage_type: "licensed" }, tax_behavior: "inclusive", lookup_key: lookup, product: products[name] })
          : await s.prices.create({ currency: "eur", unit_amount: amount, recurring: { interval }, tax_behavior: "inclusive", lookup_key: lookup, product: products[name] });
      }
      lines.push(key + "=" + price.id);
      const shown = Array.isArray(amount) ? amount.map((a) => a / 100).join(" / ") + " € par utilisateur (dégressif)" : (price.unit_amount / 100).toFixed(2).replace(".", ",") + " €";
      console.log("  ✔ " + name + " : " + shown + " TVAC / " + (interval === "year" ? "an" : "mois") + (price.livemode ? "" : " (test)"));
    }
    fs.writeFileSync(process.env.OUT, lines.join("\n") + "\n");
  })().catch((e) => { console.error("✖ Stripe : " + e.message); process.exit(1); });
'
if [ "$ONLY" = skydev ]; then sed -i -E '/^STRIPE_PRICE_(SKYDEV|MODULE)_/d' "$ENV_FILE"; else sed -i '/^STRIPE_PRICE_/d' "$ENV_FILE"; fi
cat "$OUT" >> "$ENV_FILE"; rm -f "$OUT"; chmod 600 "$ENV_FILE"
echo "✔ Prix enregistrés dans $ENV_FILE (relancer l'app pour les prendre en compte)."

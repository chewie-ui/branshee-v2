import { test } from "node:test";
import assert from "node:assert/strict";
import { docSeller, isReverseCharge, noVat, totals, vatMention } from "./invoicing";
import { buildUbl } from "./ubl";

const lines = [{ id: "1", desc: "Pose de carrelage", qty: 10, unit: "heure", price: 50, vat: 21 }];

test("Autoliquidation : facture sans TVA, mention légale, n° de TVA du vendeur gardé", () => {
  assert.equal(isReverseCharge("autoliquidation"), true);
  assert.equal(noVat("autoliquidation"), true);
  const t = totals(lines as never, "autoliquidation");
  assert.equal(t.ht, 500);
  assert.equal(t.tva, 0);
  assert.equal(t.ttc, 500);
  assert.match(vatMention("autoliquidation")!, /cocontractant/);
  assert.match(vatMention("intracom")!, /2006\/112/);
  assert.equal(vatMention("assujetti"), null);
  assert.deepEqual(docSeller({ seller: null, vatOverride: "autoliquidation" }, { vatRegime: "assujetti" }), { vatRegime: "autoliquidation" });
  assert.deepEqual(docSeller({ seller: { vatRegime: "assujetti" }, vatOverride: "autoliquidation" }, { vatRegime: "x" }), { vatRegime: "assujetti" });
});

test("Autoliquidation : fichier Peppol en catégorie AE", () => {
  const xml = buildUbl({
    docType: "invoice", number: "F-2026-001", issueDate: "2026-11-20", dueDate: "2026-12-20", serviceDate: null, comm: null, notes: "", lines: lines as never,
    seller: { legalName: "Plomberie X", street: "Rue 1", zip: "1300", city: "Wavre", country: "Belgique", vatNumber: "BE0123456749", bce: "0123456749", vatRegime: "autoliquidation", iban: "BE68539007547034" } as never,
    client: { name: "Construct SA", street: "Rue 2", zip: "1000", city: "Bruxelles", country: "Belgique", vat: "BE0987654321" } as never,
    relatedNumber: null,
  } as never);
  assert.match(xml, /<cbc:ID>AE<\/cbc:ID>/);
  assert.match(xml, /VATEX-EU-AE/);
  assert.doesNotMatch(xml, /<cbc:ID>S<\/cbc:ID>/);
});

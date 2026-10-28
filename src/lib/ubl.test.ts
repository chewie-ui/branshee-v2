import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUbl, enterpriseNumber, ublMissing, type UblInput } from "./ubl";

const base: UblInput = {
  docType: "invoice", number: "2026-001", issueDate: "2026-10-28", dueDate: "2026-11-12", serviceDate: "2026-10-28", comm: "+++123/4567/89002+++", notes: "Merci & à bientôt",
  lines: [{ id: "a", desc: "Site <web>", qty: 2, unit: "jour", price: 450, vat: 21 }, { id: "b", desc: "Livre", qty: 1, unit: "pièce", price: 20, vat: 6 }],
  seller: { legalName: "Skydev SRL", vatNumber: "BE0123456789", street: "Rue 1", zip: "1300", city: "Wavre", iban: "BE68539007547034", vatRegime: "assujetti" },
  client: { name: "Client SA", vat: "BE0987654321", street: "Rue 2", zip: "1000", city: "Bruxelles" },
};

test("n° d'entreprise", () => {
  assert.equal(enterpriseNumber({ vat: "BE 0123.456.789" }), "0123456789");
  assert.equal(enterpriseNumber({ bce: "123456789" }), "0123456789");
  assert.equal(enterpriseNumber({ vat: "FR12345678901" }), null);
});
test("UBL facture assujetti", () => {
  const xml = buildUbl(base);
  assert.match(xml, /<cbc:InvoiceTypeCode>380<\/cbc:InvoiceTypeCode>/);
  assert.match(xml, /<cbc:EndpointID schemeID="0208">0123456789<\/cbc:EndpointID>/);
  assert.match(xml, /<cbc:TaxableAmount currencyID="EUR">900.00<\/cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">189.00/);
  assert.match(xml, /<cbc:PayableAmount currencyID="EUR">1110.20<\/cbc:PayableAmount>/);
  assert.match(xml, /Site &lt;web&gt;/);
  assert.match(xml, /Merci &amp; à bientôt/);
  assert.deepEqual(ublMissing(base), []);
});
test("UBL note de crédit en franchise", () => {
  const xml = buildUbl({ ...base, docType: "credit", relatedNumber: "2026-001", seller: { ...base.seller, vatRegime: "franchise" } });
  assert.match(xml, /<CreditNote /);
  assert.match(xml, /<cbc:ID>E<\/cbc:ID><cbc:Percent>0<\/cbc:Percent><cbc:TaxExemptionReason>/);
  assert.match(xml, /<cac:InvoiceDocumentReference><cbc:ID>2026-001/);
  assert.ok(ublMissing({ ...base, client: { name: "X" } }).length >= 2);
});

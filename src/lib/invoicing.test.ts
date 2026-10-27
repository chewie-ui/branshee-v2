import { test } from "node:test";
import assert from "node:assert/strict";
import { bceValid, epcPayload, formatNumber, ibanValid, structComm, totals } from "./invoicing";

const line = (qty: number, price: number, vat = 21) => ({ id: "x", desc: "x", qty, unit: "forfait", price, vat });

test("totaux en franchise : pas de TVA", () => {
  const t = totals([line(2, 50), line(1, 19.99)], "franchise");
  assert.deepEqual([t.ht, t.tva, t.ttc, t.vatRows.length], [119.99, 0, 119.99, 0]);
});

test("totaux assujetti : TVA par taux, arrondis au cent", () => {
  const t = totals([line(1, 100, 21), line(3, 10.1, 6), line(1, 5, 0)], "assujetti");
  assert.equal(t.ht, 135.3);
  assert.deepEqual(t.vatRows, [{ rate: 21, base: 100, amt: 21 }, { rate: 6, base: 30.3, amt: 1.82 }, { rate: 0, base: 5, amt: 0 }]);
  assert.equal(t.tva, 22.82);
  assert.equal(t.ttc, 158.12);
});

test("numéros : facture, note de crédit, devis", () => {
  assert.equal(formatNumber("invoice", 2026, 7, "SKY"), "SKY-2026-007");
  assert.equal(formatNumber("credit", 2026, 1), "NC-2026-001");
  assert.equal(formatNumber("quote", 2026, 12, "SKY"), "D-2026-012");
});

test("communication structurée : modulo 97 valide", () => {
  const c = structComm(2026, 1, "invoice");
  assert.match(c, /^\+\+\+\d{3}\/\d{4}\/\d{5}\+\+\+$/);
  const digits = c.replace(/\D/g, "");
  const mod = Number(digits.slice(0, 10)) % 97 || 97;
  assert.equal(Number(digits.slice(10)), mod);
});

test("IBAN et numéro d'entreprise", () => {
  assert.equal(ibanValid("BE68 5390 0754 7034"), true);
  assert.equal(ibanValid("BE68 5390 0754 7035"), false);
  assert.equal(bceValid("1044.474.917"), true);
  assert.equal(bceValid("1044.474.918"), false);
});

test("QR de paiement EPC", () => {
  const p = epcPayload({ iban: "BE68539007547034", tradeName: "Skydev" }, 121, "+++202/6100/00141+++");
  assert.ok(p?.startsWith("BCD\n002\n1\nSCT\n"));
  assert.ok(p?.includes("EUR121.00"));
  assert.equal(epcPayload({ iban: "faux" }, 10, ""), null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { guessMapping, parseCsv, parseMoney, toClients, toProducts } from "./import";

test("CSV : séparateur, guillemets, BOM, retour à la ligne", () => {
  assert.deepEqual(parseCsv('﻿Nom;Email\n"Dupont; Marie";m@x.be\r\n\n"Ligne ""2""\nsuite";'), [["Nom", "Email"], ["Dupont; Marie", "m@x.be"], ['Ligne "2"\nsuite', ""]]);
  assert.deepEqual(parseCsv("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
});

test("colonnes devinées (fr / nl / en)", () => {
  const m = guessMapping(["Prénom", "Nom", "E-mail", "GSM", "Code postal", "Localité", "Notes"], "clients");
  assert.equal(m.firstName, 0); assert.equal(m.lastName, 1); assert.equal(m.email, 2); assert.equal(m.phone, 3); assert.equal(m.postalCode, 4); assert.equal(m.city, 5); assert.equal(m.fullName, -1);
  const p = guessMapping(["Artikelnummer", "Naam", "Verkoopprijs", "BTW", "Voorraad", "EAN"], "produits");
  assert.deepEqual([p.sku, p.name, p.price, p.vatRate, p.stockQty, p.barcode], [0, 1, 2, 3, 4, 5]);
});

test("montants", () => {
  assert.equal(parseMoney("12,50 €"), 1250); assert.equal(parseMoney("1.234,56"), 123456); assert.equal(parseMoney("12.5"), 1250); assert.equal(parseMoney("1,234.00"), 123400); assert.equal(parseMoney("abc"), null); assert.equal(parseMoney("-3"), null);
});

test("clients et produits : lignes valides et refusées", () => {
  const c = toClients([["Marie", "Dupont", "MARIE@X.BE"], ["", "", ""], ["Jean", "", "pas-un-email"]], { firstName: 0, lastName: 1, email: 2 });
  assert.equal(c.ok.length, 1); assert.equal(c.ok[0]!.fullName, "Marie Dupont"); assert.equal(c.ok[0]!.email, "marie@x.be");
  assert.deepEqual(c.errors.map((e) => e.line), [3, 4]);
  const p = toProducts([["Savon", "6,50", "21%", "12"], ["Huile", "x", "21", "1"], ["Livre", "15", "0,06", ""]], { name: 0, price: 1, vatRate: 2, stockQty: 3 });
  assert.deepEqual(p.ok.map((x) => [x.name, x.priceCents, x.vatRate, x.stockQty]), [["Savon", 650, 21, 12], ["Livre", 1500, 6, 0]]);
  assert.equal(p.errors[0]!.line, 3);
});

test("import : limites (colonnes, lignes vides, zip)", async () => {
  const { zipStats, MAX_COLS } = await import("./import");
  assert.equal(parseCsv("a" + ";".repeat(5000) + "\nb")[0]!.length, MAX_COLS);
  const blank = "Nom\n" + Array.from({ length: 30 }, (_, i) => `n${i}\n;`).join("\n");
  assert.equal(parseCsv(blank).length, 31);
  assert.equal(zipStats(new Uint8Array([1, 2, 3])), null);
});

test("colonne Code-barres reconnue", () => {
  const m = guessMapping(["Nom", "Prix", "Code-barres"], "produits");
  assert.equal(m.barcode, 2);
  assert.equal(m.sku, -1);
});

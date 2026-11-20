import { test } from "node:test";
import assert from "node:assert/strict";
import { INAMI_CODES, amounts, categoryForPathology, codesFor, inamiCode, isBim, shortLabel } from "./inami-kine";

test("Nomenclature kiné : codes et tarifs au 1/7/2026", () => {
  assert.ok(INAMI_CODES.length > 200);
  const s = inamiCode("567011")!;
  assert.equal(s.fee, 31.64);
  assert.match(s.label, /30 minutes/);
  // Tarif BIM conventionné : la mutuelle rembourse 29,14 €, le patient paie 2,50 €.
  assert.deepEqual(amounts(s, { bim: true, conventioned: true }), { fee: 31.64, refund: 29.14, patient: 2.5 });
  assert.deepEqual(amounts(s, { bim: false, conventioned: true }), { fee: 31.64, refund: 25.39, patient: 6.25 });
  assert.ok(inamiCode("567206"), "code hospitalisé seul");
  assert.equal(inamiCode("999999"), null);
});

test("Nomenclature kiné : filtres, BIM et libellés courts", () => {
  assert.equal(categoryForPathology("Fa"), 5);
  assert.equal(categoryForPathology("autre"), null);
  const list = codesFor("I.a)", 1);
  assert.ok(list.some((c) => c.code === "567011") && list.every((c) => c.place === "I.a)"));
  assert.equal(isBim("111"), true);
  assert.equal(isBim("110"), false);
  assert.equal(isBim(null), false);
  assert.ok(shortLabel(inamiCode("560011")!).startsWith("Si séance normale impossible"));
  assert.ok(shortLabel(inamiCode("560011")!).length <= 90);
});

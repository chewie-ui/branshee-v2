import { test } from "node:test";
import assert from "node:assert/strict";
import { SIZE_GRIDS, combinations, sizeHint, sortSizes, variantName } from "./sizes";

test("grilles : valeurs uniques", () => {
  for (const g of SIZE_GRIDS) assert.equal(new Set(g.sizes.map((s) => s.value)).size, g.sizes.length, g.id);
});

test("équivalences", () => {
  assert.equal(sizeHint("shoes", "42"), "UK 8 · US F 10,5 · US H 9");
  assert.equal(sizeHint("women", "38"), "US 6 · UK 10 · M");
  assert.equal(sizeHint("letters", "M"), undefined);
  assert.equal(sizeHint("custom", "42"), undefined);
});

test("combinaisons taille × couleur", () => {
  assert.equal(combinations(["S", "M"], ["Noir", "Blanc"]).length, 4);
  assert.deepEqual(combinations(["S"], []), [{ size: "S", color: null }]);
  assert.deepEqual(combinations([], ["Rouge"]), [{ size: null, color: "Rouge" }]);
  assert.deepEqual(combinations([], []), []);
  assert.equal(variantName("T-shirt", { size: "M", color: "Noir" }), "T-shirt — M / Noir");
});

test("tri des tailles", () => {
  assert.deepEqual(sortSizes("letters", ["XL", "S", "M"]), ["S", "M", "XL"]);
  assert.deepEqual(sortSizes("custom", ["200 ml", "50 ml", "100 ml"]), ["50 ml", "100 ml", "200 ml"]);
});

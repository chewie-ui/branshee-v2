import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDecimal } from "./decimal";

test("parseDecimal : formats belges et anglais", () => {
  assert.equal(parseDecimal("12,50"), 12.5);
  assert.equal(parseDecimal("12.50"), 12.5);
  assert.equal(parseDecimal("1.234,56"), 1234.56);
  assert.equal(parseDecimal("1 234,56"), 1234.56);
  assert.equal(parseDecimal("1 234,56"), 1234.56);
  assert.equal(parseDecimal("1.234.567"), 1234567);
  assert.equal(parseDecimal("-3,5"), -3.5);
  assert.equal(parseDecimal("12,"), 12);
  assert.equal(parseDecimal(7), 7);
});

test("parseDecimal : texte invalide = NaN", () => {
  assert.ok(Number.isNaN(parseDecimal("")));
  assert.ok(Number.isNaN(parseDecimal("abc")));
  assert.ok(Number.isNaN(parseDecimal("1,2,3")));
  assert.ok(Number.isNaN(parseDecimal(null)));
});

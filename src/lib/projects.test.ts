import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtMinutes, parseDuration, timeValue } from "./projects";

test("durées saisies", () => {
  assert.equal(parseDuration("1h30"), 90);
  assert.equal(parseDuration("1:05"), 65);
  assert.equal(parseDuration("2h"), 120);
  assert.equal(parseDuration("1,5"), 90);
  assert.equal(parseDuration("0.25"), 15);
  assert.equal(parseDuration("45"), 45);
  assert.equal(parseDuration("3"), 180);
  assert.equal(parseDuration("90 min"), 90);
  assert.equal(parseDuration("abc"), null);
  assert.equal(parseDuration(""), null);
});
test("affichage", () => {
  assert.equal(fmtMinutes(95), "1 h 35");
  assert.equal(fmtMinutes(60), "1 h");
  assert.equal(fmtMinutes(20), "20 min");
  assert.equal(fmtMinutes(0), "0 min");
});
test("montant du temps", () => {
  assert.equal(timeValue(90, 6000), 9000);
  assert.equal(timeValue(20, 5000), 1667);
});

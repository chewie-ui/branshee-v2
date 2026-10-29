import { test } from "node:test";
import assert from "node:assert/strict";
import { referralMonths } from "./referral";

test("1 filleul validé = 1 mois, plafonné à 12 par an", () => {
  assert.equal(referralMonths([]), 0);
  assert.equal(referralMonths([1]), 1);
  assert.equal(referralMonths([5]), 5);
  assert.equal(referralMonths([20]), 12);
  assert.equal(referralMonths([20, 3]), 15);
  assert.equal(referralMonths([-1]), 0);
});

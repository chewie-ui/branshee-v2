import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, giftCode, normalizeCode, stampProgress } from "./loyalty";

test("codes cartes cadeaux", () => {
  const c = giftCode(() => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
  assert.equal(c, "ABCD-EFGH");
  assert.match(giftCode((n) => crypto.getRandomValues(new Uint8Array(n))), /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(normalizeCode(" abcd efgh "), "ABCD-EFGH");
});
test("mois et tampons", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-10-28", 12), "2027-10-28");
  assert.deepEqual(stampProgress(10, 10), { ready: true, left: 0 });
  assert.deepEqual(stampProgress(3, 10), { ready: false, left: 7 });
});

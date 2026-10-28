import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePeriod, periodKey, periodRange, sumByRate, vatBalance } from "./accounting";

test("périodes", () => {
  assert.deepEqual(periodRange({ kind: "quarter", year: 2026, index: 4 }).from, "2026-10-01");
  assert.equal(periodRange({ kind: "quarter", year: 2026, index: 1 }).to, "2026-03-31");
  assert.equal(periodRange({ kind: "month", year: 2028, index: 2 }).to, "2028-02-29");
  assert.equal(periodKey(parsePeriod(undefined, "2026-10-28")), "2026-T4");
  assert.equal(periodKey(parsePeriod("2026-03", "2026-10-28")), "2026-03");
  assert.equal(periodKey(parsePeriod("2025", "2026-10-28")), "2025");
});
test("TVA", () => {
  assert.deepEqual(sumByRate([{ rate: 21, base: 1000, vat: 210 }, { rate: 6, base: 500, vat: 30 }, { rate: 21, base: -200, vat: -42 }]), [{ rate: 21, base: 800, vat: 168 }, { rate: 6, base: 500, vat: 30 }]);
  assert.equal(vatBalance(500, 700), -200);
});

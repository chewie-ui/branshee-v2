import { test } from "node:test";
import assert from "node:assert/strict";
import { contractMinutes, grossEstimate, leaveHalfDaysInMonth, monthBounds, shiftMonth } from "./payroll";

test("mois", () => {
  assert.deepEqual(monthBounds("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});
test("absences sur deux mois", () => {
  // Du lundi 26 au mercredi 4 novembre 2026 : octobre = 26..30 (5 jours), novembre = 2..4 (le 1er est férié et un dimanche, le 3/4 ouvrables)
  assert.equal(leaveHalfDaysInMonth("2026-10-26", "2026-11-04", "full", "2026-10"), 10);
  assert.equal(leaveHalfDaysInMonth("2026-10-28", "2026-10-28", "am", "2026-10"), 1);
  assert.equal(leaveHalfDaysInMonth("2026-09-01", "2026-09-05", "full", "2026-10"), 0);
});
test("contrat et brut", () => {
  assert.equal(contractMinutes(2280, "2026-10"), 456 * 22);
  assert.equal(grossEstimate({ payType: "hourly", rateCents: 1500 }, 90, 1000), 3250);
  assert.equal(grossEstimate({ payType: "monthly", rateCents: 250000 }, 1, 0), 250000);
});

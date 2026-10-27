import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, fmtHours, isoWeek, mondayOf, overnight, shiftMinutes, weekDays } from "./planning";

test("lundi de la semaine", () => {
  assert.equal(mondayOf("2026-10-27"), "2026-10-26");
  assert.equal(mondayOf("2026-11-01"), "2026-10-26");
  assert.equal(mondayOf("2026-10-26"), "2026-10-26");
  assert.deepEqual(weekDays("2026-10-26").slice(-1), ["2026-11-01"]);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("numéro de semaine ISO", () => {
  assert.equal(isoWeek("2026-10-27"), 44);
  assert.equal(isoWeek("2027-01-01"), 53);
  assert.equal(isoWeek("2026-01-01"), 1);
});

test("heures d'une plage", () => {
  assert.equal(shiftMinutes("09:00", "17:00", 30), 450);
  assert.equal(shiftMinutes("18:00", "02:00"), 480);
  assert.ok(overnight("22:00", "06:00"));
  assert.equal(fmtHours(450), "7 h 30");
  assert.equal(fmtHours(2280), "38 h");
});

test("dates impossibles refusées", async () => {
  const { isDay } = await import("./planning");
  assert.equal(isDay("2026-02-31"), false);
  assert.equal(isDay("2026-13-01"), false);
  assert.equal(isDay("2026-11-05"), true);
  assert.equal(isDay("2026-11-5"), false);
});

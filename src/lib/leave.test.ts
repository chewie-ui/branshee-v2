import { test } from "node:test";
import assert from "node:assert/strict";
import { belgianHolidays, fmtDays, leaveHalfDays, workingDays } from "./leave";

test("jours fériés belges 2026", () => {
  const h = belgianHolidays(2026);
  assert.equal(h.get("2026-04-06"), "Lundi de Pâques");
  assert.equal(h.get("2026-05-14"), "Ascension");
  assert.equal(h.get("2026-05-25"), "Lundi de Pentecôte");
  assert.equal(h.size, 10);
});

test("jours ouvrables : week-end et fériés exclus", () => {
  assert.equal(workingDays("2026-11-02", "2026-11-08").length, 5);
  assert.equal(workingDays("2026-11-09", "2026-11-13").length, 4); // 11 nov. férié
  assert.equal(leaveHalfDays("2026-11-09", "2026-11-13"), 8);
  assert.equal(leaveHalfDays("2026-11-16", "2026-11-16", "am"), 1);
  assert.equal(leaveHalfDays("2026-11-14", "2026-11-14", "am"), 0); // samedi
});

test("affichage des jours", () => {
  assert.equal(fmtDays(1), "½ jour");
  assert.equal(fmtDays(5), "2,5 jours");
  assert.equal(fmtDays(40), "20 jours");
});

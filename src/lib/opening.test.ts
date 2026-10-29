import { test } from "node:test";
import assert from "node:assert/strict";
import { boundsFrom, merge, outsideBounds, summarize } from "./opening";

test("fusion des plages", () => {
  assert.deepEqual(merge([{ start: "13:00", end: "18:00" }, { start: "09:00:00", end: "12:00:00" }, { start: "11:00", end: "13:30" }]), [{ start: "09:00", end: "18:00" }]);
});

test("cadre : jours fermés et heures hors ouverture refusés", () => {
  const b = boundsFrom([{ weekday: 4, start: "09:00:00", end: "12:00:00" }, { weekday: 4, start: "13:00:00", end: "18:00:00" }, { weekday: 1, start: "09:00:00", end: "18:00:00" }]);
  assert.equal(outsideBounds({ 4: [{ start: "14:00", end: "17:00" }] }, b), null);
  assert.match(outsideBounds({ 2: [{ start: "10:00", end: "11:00" }] }, b)!, /fermé le mardi/);
  assert.match(outsideBounds({ 4: [{ start: "16:00", end: "19:00" }] }, b)!, /jeudi/);
  assert.match(outsideBounds({ 4: [{ start: "11:00", end: "14:00" }] }, b)!, /jeudi/, "à cheval sur la pause de midi");
  assert.equal(outsideBounds({ 2: [{ start: "10:00", end: "11:00" }] }, null), null, "sans horaires d'ouverture : pas de cadre");
});

test("résumé", () => {
  assert.equal(summarize({ 4: [{ start: "14:00:00", end: "17:00:00" }], 1: [{ start: "09:00", end: "12:00" }] }), "Lun 09:00–12:00 · Jeu 14:00–17:00");
});

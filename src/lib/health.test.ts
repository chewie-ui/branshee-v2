import { test } from "node:test";
import assert from "node:assert/strict";
import { isNoise, jobLate, normalizeMessage, routeOf } from "./health";

test("regroupement des erreurs", () => {
  assert.equal(normalizeMessage("Client 3f2b1c9e-1111-4222-8333-444455556666 introuvable (ligne 42)"), "Client <id> introuvable (ligne <n>)");
  assert.equal(routeOf("/app/clients/3f2b1c9e-1111-4222-8333-444455556666?onglet=dossier"), "/app/clients/<id>");
  assert.equal(routeOf("/facture/abcdefghijklmnopqrstuv/pdf"), "/facture/<jeton>/pdf");
  assert.ok(isNoise('The Server Reference ID did not match the expected format'));
  assert.ok(!isNoise("relation \"foo\" does not exist"));
});

test("tâches en retard", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  assert.equal(jobLate("reminders", new Date("2026-10-29T11:40:00Z"), now), false);
  assert.equal(jobLate("reminders", new Date("2026-10-29T10:00:00Z"), now), true);
  assert.equal(jobLate("daily", new Date("2026-10-28T10:05:00Z"), now), false);
  assert.equal(jobLate("daily", new Date("2026-10-27T09:00:00Z"), now), true);
  assert.equal(jobLate("daily", null, now), true);
});

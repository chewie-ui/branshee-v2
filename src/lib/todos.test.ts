import { test } from "node:test";
import assert from "node:assert/strict";
import { dueLabel, nextDue, parseQuickAdd } from "./todos";

const T = "2026-10-28"; // mercredi
const lists = [{ id: "L1", name: "Chantier Dupont" }, { id: "L2", name: "Admin" }];
const people = [{ id: "M1", name: "Lucas Martin" }, { id: "M2", name: "Léa Dubois" }];

test("ajout rapide : date, heure, priorité, liste, personne", () => {
  const r = parseQuickAdd("Appeler Marc demain 14h p1 #chantier @lucas", T, lists, people);
  assert.deepEqual(r, { title: "Appeler Marc", dueDate: "2026-10-29", dueTime: "14:00", priority: 1, listId: "L1", assigneeId: "M1", recurrence: null });
  assert.equal(parseQuickAdd("Facture lundi", T).dueDate, "2026-11-02");
  assert.equal(parseQuickAdd("Rdv le 12/11 à 9h30", T).dueTime, "09:30");
  assert.equal(parseQuickAdd("Rdv le 12/11 à 9h30", T).dueDate, "2026-11-12");
  assert.equal(parseQuickAdd("Noël le 25 décembre", T).dueDate, "2026-12-25");
  assert.equal(parseQuickAdd("Bilan le 3 février", T).dueDate, "2027-02-03");
  assert.equal(parseQuickAdd("Payer le 5", T).dueDate, "2026-11-05");
  assert.equal(parseQuickAdd("Relancer dans 2 semaines", T).dueDate, "2026-11-11");
  assert.equal(parseQuickAdd("Courses ce soir 19h", T).dueDate, T);
  assert.equal(parseQuickAdd("Message @léa", T, lists, people).assigneeId, "M2");
  assert.equal(parseQuickAdd("Écrire à #inconnu", T, lists).title, "Écrire à #inconnu");
  assert.equal(parseQuickAdd("Le 31/02", T).dueDate, null);
});

test("ajout rapide : récurrences", () => {
  assert.deepEqual([parseQuickAdd("Sortir les poubelles tous les mardis", T).recurrence, parseQuickAdd("Sortir les poubelles tous les mardis", T).dueDate], ["weekly", "2026-11-03"]);
  assert.equal(parseQuickAdd("Caisse chaque jour 18h", T).recurrence, "daily");
  assert.equal(parseQuickAdd("TVA chaque mois le 20", T).dueDate, "2026-11-20");
});

test("prochaine échéance", () => {
  assert.equal(nextDue("2026-10-28", "daily", T), "2026-10-29");
  assert.equal(nextDue("2026-10-30", "weekdays", "2026-10-30"), "2026-11-02");
  assert.equal(nextDue("2026-01-31", "monthly", "2026-01-31"), "2026-02-28");
  assert.equal(nextDue("2026-10-01", "weekly", T), "2026-10-29");
  assert.equal(nextDue("2024-02-29", "yearly", "2024-02-29"), "2025-02-28");
});

test("libellés", () => {
  assert.deepEqual(dueLabel(T, T), { text: "Aujourd'hui", late: false });
  assert.equal(dueLabel("2026-10-30", T).text, "Vendredi");
  assert.equal(dueLabel("2026-10-20", T).late, true);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { documentGaps, TO_FILL } from "./care-team";
import { ALL_PERMISSIONS, NO_PERMISSIONS, can, withDefaults, type Permissions } from "./permissions";

test("Documents : rubriques obligatoires et « à compléter »", () => {
  const ok = "Intro\n\nDIAGNOSTIC KINÉ\n\nEntorse\n\nTRAITEMENT\n\nRenforcement\n\nÉVOLUTION\n\nMieux\n\nCONCLUSION\n\nArrêt";
  assert.deepEqual(documentGaps("rapport_prescripteur", ok), []);
  const gaps = documentGaps("rapport_prescripteur", `DIAGNOSTIC KINÉ\n\n${TO_FILL}\n\nTRAITEMENT\n\nX`);
  assert.ok(gaps.some((g) => g.includes("DIAGNOSTIC KINÉ") && g.includes("vide")));
  assert.ok(gaps.some((g) => g.includes("ÉVOLUTION") && g.includes("absente")));
  assert.ok(gaps.some((g) => g.includes(TO_FILL)));
  assert.deepEqual(documentGaps("courrier", "Bonjour"), []);
});

test("Permissions : dossier de soins repris des droits Clients pour les anciens grades", () => {
  const old = structuredClone(NO_PERMISSIONS) as Partial<Permissions>;
  delete old.records;
  old.customers = { view: true, manage: false };
  assert.equal(can(old as Permissions, "records.view"), true);
  assert.equal(can(old as Permissions, "records.manage"), false);
  assert.equal(can(old as Permissions, "records.export"), false);
  assert.deepEqual(withDefaults(old as Permissions).records, { view: true, manage: false, export: false });
  const secretariat = { ...ALL_PERMISSIONS, records: { view: false, manage: false, export: false } };
  assert.equal(can(secretariat, "records.view"), false);
  assert.equal(can(secretariat, "records.view", true), true);
});

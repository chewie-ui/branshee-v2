import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNiss, nissFacts, normalizeNiss, validNiss } from "./niss";

test("NISS : clé de contrôle avant et après 2000", () => {
  assert.equal(validNiss("85.07.30-033.28"), true);
  assert.equal(validNiss("85073003329"), false);
  assert.equal(validNiss("00012556777"), true); // né en 2000
  assert.equal(validNiss("123"), false);
});

test("NISS : format, date de naissance et sexe", () => {
  assert.equal(normalizeNiss(" 85.07.30-033.28 "), "85073003328");
  assert.equal(formatNiss("85073003328"), "85.07.30-033.28");
  assert.deepEqual(nissFacts("85073003328"), { birthDate: "1985-07-30", sex: "M" });
  assert.deepEqual(nissFacts("00012556777"), { birthDate: "2000-01-25", sex: "M" });
});

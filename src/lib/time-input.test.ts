import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseQuickTime } from "./time-input";

describe("saisie rapide d'heure", () => {
  it("comprend les formats courants", () => {
    for (const [i, o] of [["9", "09:00"], ["930", "09:30"], ["0930", "09:30"], ["9h30", "09:30"], ["18 h", "18:00"], ["9:5", "09:50"], ["14.15", "14:15"], ["1800", "18:00"]] as const) assert.equal(parseQuickTime(i), o, i);
  });
  it("refuse les heures impossibles", () => {
    for (const i of ["25", "9h75", "abc", ""]) assert.equal(parseQuickTime(i), null, i);
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { followUpState, weighted, winRate } from "./sales";

test("pondère les pistes ouvertes seulement", () => {
  assert.equal(weighted([{ stage: "lead", valueCents: 1000 }, { stage: "quote", valueCents: 2000 }, { stage: "won", valueCents: 99999 }, { stage: "lost", valueCents: 5000 }]), 100 + 1000);
});
test("taux de réussite", () => {
  assert.equal(winRate([{ stage: "won", valueCents: 0 }, { stage: "lost", valueCents: 0 }, { stage: "lost", valueCents: 0 }, { stage: "lead", valueCents: 0 }]), 33);
  assert.equal(winRate([{ stage: "lead", valueCents: 0 }]), null);
});
test("état des relances", () => {
  assert.equal(followUpState("2026-10-01", "2026-10-02"), "late");
  assert.equal(followUpState("2026-10-02", "2026-10-02"), "today");
  assert.equal(followUpState("2026-10-09", "2026-10-02"), "soon");
  assert.equal(followUpState(null, "2026-10-02"), "none");
});

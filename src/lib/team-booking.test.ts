import { test } from "node:test";
import assert from "node:assert/strict";
import { memberFromSlug, memberSlug, teamChoiceOf } from "./team-booking";

const team = [
  { id: "aaaa1111-0000-0000-0000-000000000000", name: "Léa Martin" },
  { id: "bbbb2222-0000-0000-0000-000000000000", name: "Marc Dubois" },
  { id: "cccc3333-0000-0000-0000-000000000000", name: "Marc Dubois" },
];

test("adresse d'un praticien : prénom-nom, unique dans l'équipe", () => {
  assert.equal(memberSlug(team[0]!, team), "lea-martin");
  assert.equal(memberSlug(team[1]!, team), "marc-dubois-bbbb");
  assert.equal(memberFromSlug("lea-martin", team)?.id, team[0]!.id);
  assert.equal(memberFromSlug("marc-dubois-cccc", team)?.id, team[2]!.id);
  assert.equal(memberFromSlug("marc-dubois", team), null);
  assert.equal(memberFromSlug("<script>", team), null);
  assert.equal(memberFromSlug(undefined, team), null);
});

test("mode d'équipe", () => {
  assert.equal(teamChoiceOf("auto"), "auto");
  assert.equal(teamChoiceOf("n'importe quoi"), "choose");
  assert.equal(teamChoiceOf(null), "choose");
});

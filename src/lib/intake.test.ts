import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { questionMatters, serviceMatches, type IntakeQuestion } from "./intake";

const pregnant: IntakeQuestion = { id: "q1", question: "Êtes-vous enceinte ?", options: [{ id: "yes", label: "Oui", serviceIds: ["prenatal"] }, { id: "no", label: "Non", serviceIds: ["classic", "sport"] }] };
const sport: IntakeQuestion = { id: "q2", question: "Blessure sportive ?", options: [{ id: "s-yes", label: "Oui", serviceIds: ["sport"] }, { id: "s-no", label: "Non", serviceIds: [] }] };

describe("questionnaire d'orientation", () => {
  it("n'affiche que les prestations liées à la réponse", () => {
    const shown = ["prenatal", "classic", "sport", "bilan"].filter((s) => serviceMatches(s, [pregnant], { q1: "yes" }));
    assert.deepEqual(shown, ["prenatal", "bilan"]);
  });
  it("une prestation sans lien avec la question reste proposée", () => {
    assert.equal(serviceMatches("bilan", [pregnant, sport], { q1: "no", q2: "s-no" }), true);
  });
  it("combine plusieurs questions", () => {
    assert.equal(serviceMatches("sport", [pregnant, sport], { q1: "no", q2: "s-yes" }), true);
    assert.equal(serviceMatches("sport", [pregnant, sport], { q1: "no", q2: "s-no" }), false);
  });
  it("saute une question qui ne change rien aux prestations restantes", () => {
    assert.equal(questionMatters(sport, ["prenatal", "bilan"]), false);
    assert.equal(questionMatters(sport, ["classic", "sport"]), true);
  });
});

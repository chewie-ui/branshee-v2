import { test } from "node:test";
import assert from "node:assert/strict";
import { matchMetier, metierFromSlug, pageCompleteness, splitQuery, villeFromSlug, knownVilles } from "./directory";

test("matchMetier reconnaît synonymes et accents", () => {
  assert.equal(matchMetier("Coiffeuse")?.slug, "coiffeur");
  assert.equal(matchMetier("kiné")?.slug, "kine");
  assert.equal(matchMetier("kinesitherapeutes")?.slug, "kine");
  assert.equal(matchMetier("Salon de coiffure")?.slug, "coiffeur");
  assert.equal(matchMetier("boulanger"), null);
  assert.equal(matchMetier(""), null);
});

test("métier et ville depuis l'adresse", () => {
  assert.equal(metierFromSlug("kine", [])?.nom, "kinésithérapeute");
  assert.equal(metierFromSlug("plombier", ["Plombier", "plombier "])?.pluriel, "plombiers");
  assert.equal(metierFromSlug("inconnu", ["Plombier"]), null);
  assert.equal(villeFromSlug("wavre", [])?.nom, "Wavre");
  assert.equal(villeFromSlug("rixensart", ["rixensart"])?.nom, "Rixensart");
  assert.equal(villeFromSlug("nulle-part", ["Wavre"]), null);
});

test("splitQuery sépare métier et ville", () => {
  const v = knownVilles();
  assert.deepEqual(splitQuery("coiffeur wavre", v), { what: "coiffeur", where: "Wavre" });
  assert.deepEqual(splitQuery("kiné à Louvain-la-Neuve", v), { what: "kine", where: "Louvain-la-Neuve" });
  assert.equal(splitQuery("coiffeur", v), null);
  assert.equal(splitQuery("wavre", v), null);
});

test("pageCompleteness", () => {
  const r = pageCompleteness({ photo: false, description: true, type: true, address: true, services: 2, hours: false, reviews: 0 });
  assert.equal(r.done, 4);
  assert.equal(r.percent, 67);
  assert.equal(r.listed, true);
});

test("un métier qui est une ville ne crée pas de page", () => {
  assert.equal(metierFromSlug("wavre", ["Wavre"]), null);
});

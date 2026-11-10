import { test } from "node:test";
import assert from "node:assert/strict";
import { localeOfPath, localize, unlocalize } from "./site-locale";

test("langue de l'adresse", () => {
  assert.equal(localeOfPath("/en"), "en");
  assert.equal(localeOfPath("/en/apps"), "en");
  assert.equal(localeOfPath("/entreprise"), "fr");
  assert.equal(localeOfPath("/apps"), "fr");
  assert.equal(localeOfPath(null), "fr");
});

test("liens localisés", () => {
  assert.equal(localize("/", "en"), "/en");
  assert.equal(localize("/#tarifs", "en"), "/en#tarifs");
  assert.equal(localize("/sur-mesure/application-web-saas", "en"), "/en/custom/application-web-saas");
  assert.equal(localize("/logiciel/garage", "en"), "/en/software/garage");
  assert.equal(localize("/apps", "en"), "/en/apps");
  assert.equal(localize("/inscription?x=1", "en"), "/en/signup?x=1");
  assert.equal(localize("/app/apps", "en"), "/app/apps");
  assert.equal(localize("/annuaire", "en"), "/annuaire");
  assert.equal(localize("/apps", "fr"), "/apps");
  assert.equal(localize("https://x.be", "en"), "https://x.be");
});

test("retour en français", () => {
  assert.equal(unlocalize("/en"), "/");
  assert.equal(unlocalize("/en/custom/application-web-saas"), "/sur-mesure/application-web-saas");
  assert.equal(unlocalize("/en/software/garage"), "/logiciel/garage");
  assert.equal(unlocalize("/apps"), "/apps");
});

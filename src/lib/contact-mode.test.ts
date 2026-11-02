import { test } from "node:test";
import assert from "node:assert/strict";
import { blockedMessage, contactModeOf, isPhone, telHref } from "./contact-mode";

test("mode de contact : valeur inconnue → formulaire", () => {
  assert.equal(contactModeOf("phone"), "phone");
  assert.equal(contactModeOf("nimporte"), "form");
  assert.equal(contactModeOf(null), "form");
});

test("téléphone plausible", () => {
  assert.equal(isPhone("0477 44 39 88"), true);
  assert.equal(isPhone("+32 477 44 39 88"), true);
  assert.equal(isPhone("010/22.33.44"), true);
  assert.equal(isPhone("123"), false);
  assert.equal(isPhone("appelle-moi"), false);
});

test("lien tel et message de refus", () => {
  assert.equal(telHref("+32 477 44 39 88"), "tel:+32477443988");
  assert.match(blockedMessage("phone", "0477 44 39 88"), /0477 44 39 88/);
  assert.match(blockedMessage("callback", null), /numéro/);
});

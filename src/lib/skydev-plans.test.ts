import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_USER_PRICE, skydevPrice, userPrice } from "./skydev-plans";

test("prix par personne : baisse à chaque ajout, jamais sous 15 €", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 20].map(userPrice), [29, 25, 22, 20, 18, 16, 15, 15, 15]);
  assert.equal(MIN_USER_PRICE, 15);
});

test("total : somme des paliers, annuel = 10 mois", () => {
  assert.equal(skydevPrice(1).monthly, 29);
  assert.equal(skydevPrice(3).monthly, 76);
  assert.equal(skydevPrice(10).monthly, 29 + 25 + 22 + 20 + 18 + 16 + 15 * 4);
  assert.equal(skydevPrice(3).yearly, 760);
});

test("au moins un utilisateur", () => {
  assert.equal(skydevPrice(0).users, 1);
  assert.equal(skydevPrice(-4).monthly, 29);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { billedFor, pricingFrom, teamQuote } from "./skydev-plans";

const none = { offered: 0, first: null, extra: null };

test("prix public dégressif sans conditions", () => {
  const q = teamQuote(3, none);
  assert.equal(q.billed, 3);
  assert.equal(q.monthly, 29 + 25 + 22);
  assert.equal(q.next, 20);
});

test("utilisateurs offerts en plus du titulaire, qui paie 1 utilisateur", () => {
  assert.equal(billedFor(3, { ...none, offered: 2 }), 1);
  assert.equal(billedFor(3, { ...none, offered: 50 }), 1);
  const q = teamQuote(5, { ...none, offered: 2 });
  assert.deepEqual([q.billed, q.offered, q.monthly, q.next], [3, 2, 76, 20]);
  // Titulaire + 3 offerts = 4 personnes pour le prix d'une ; la 5e est facturée.
  assert.equal(teamQuote(3, { ...none, offered: 3 }).next, 0);
  const four = teamQuote(4, { ...none, offered: 3 });
  assert.deepEqual([four.billed, four.offered, four.next], [1, 3, 25]);
});

test("prix personnalisé : 1er utilisateur puis chacun en plus", () => {
  const p = { offered: 0, first: 19, extra: 12.5 };
  assert.equal(teamQuote(1, p).monthly, 19);
  const q = teamQuote(4, p);
  assert.equal(q.monthly, 19 + 3 * 12.5);
  assert.equal(q.yearly, (19 + 3 * 12.5) * 10);
  assert.equal(q.next, 12.5);
  assert.equal(teamQuote(2, { offered: 0, first: 15, extra: null }).monthly, 30);
});

test("lit les centimes de la base", () => {
  assert.deepEqual(pricingFrom({ offeredUsers: 3, userPriceCents: 1900, extraUserPriceCents: null }), { offered: 3, first: 19, extra: null });
  assert.deepEqual(pricingFrom(null), none);
});

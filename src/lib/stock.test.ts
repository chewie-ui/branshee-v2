import { test } from "node:test";
import assert from "node:assert/strict";
import { cartTotals, changeDue, isLow, parseEuros, ticketNumber } from "./stock";

test("totaux de caisse", () => {
  const t = cartTotals([{ qty: 2, unitCents: 1210, vatRate: 21 }, { qty: 1, unitCents: 106, vatRate: 6 }]);
  assert.equal(t.total, 2526);
  assert.equal(t.vat, 420 + 6);
  const d = cartTotals([{ qty: 1, unitCents: 1000, vatRate: 21 }], 200);
  assert.equal(d.total, 800);
  assert.equal(d.vat, 139);
  assert.equal(cartTotals([{ qty: 1, unitCents: 500, vatRate: 21 }], 9999).total, 0);
});
test("monnaie et numéros", () => {
  assert.equal(changeDue(1250, 2000), 750);
  assert.equal(changeDue(1250, 1000), null);
  assert.equal(ticketNumber(2026, 42), "T2026-000042");
  assert.equal(parseEuros("12,5"), 1250);
  assert.equal(parseEuros("abc"), null);
  assert.equal(isLow({ trackStock: true, stockQty: 2, minQty: 3 }), true);
  assert.equal(isLow({ trackStock: true, stockQty: 2, minQty: null }), false);
});

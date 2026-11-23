import { test } from "node:test";
import assert from "node:assert/strict";
import { ONE_CLICK_WINDOW_MS, isStartedSubscription, oneClickIdempotencyKey } from "./billing-oneclick";

const base = { businessId: "b1", paymentMethodId: "pm_abc", priceId: "price_1", quantity: 2, interval: "month" };

test("oneClickIdempotencyKey : même clé pour un double clic, différente sinon", () => {
  const t = 10 * ONE_CLICK_WINDOW_MS + 1000;
  assert.equal(oneClickIdempotencyKey(base, t), oneClickIdempotencyKey(base, t + 5000));
  assert.notEqual(oneClickIdempotencyKey(base, t), oneClickIdempotencyKey({ ...base, businessId: "b2" }, t));
  assert.notEqual(oneClickIdempotencyKey(base, t), oneClickIdempotencyKey({ ...base, paymentMethodId: "pm_other" }, t));
  assert.notEqual(oneClickIdempotencyKey(base, t), oneClickIdempotencyKey({ ...base, quantity: 3 }, t));
  assert.notEqual(oneClickIdempotencyKey(base, t), oneClickIdempotencyKey({ ...base, promoId: "promo1" }, t));
  assert.notEqual(oneClickIdempotencyKey(base, t), oneClickIdempotencyKey(base, t + ONE_CLICK_WINDOW_MS));
  assert.ok(oneClickIdempotencyKey(base, t).length <= 255);
});

test("isStartedSubscription", () => {
  assert.equal(isStartedSubscription("active"), true);
  assert.equal(isStartedSubscription("trialing"), true);
  assert.equal(isStartedSubscription("canceled"), false);
  assert.equal(isStartedSubscription("incomplete"), false);
});

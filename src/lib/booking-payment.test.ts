import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentLockKey } from "./booking-payment";

test("paymentLockKey : un verrou par paiement ou par carte, rien sans Stripe", () => {
  assert.equal(paymentLockKey({ stripePaymentIntentId: "pi_123" }), "stripe-pay:pi_123");
  assert.equal(paymentLockKey({ stripeSetupIntentId: "seti_9" }), "stripe-pay:seti_9");
  assert.equal(paymentLockKey({ stripePaymentIntentId: null, stripeSetupIntentId: null }), null);
  assert.equal(paymentLockKey(null), null);
  assert.equal(paymentLockKey(undefined), null);
});

test("paymentLockKey : deux réservations avec le même paiement prennent le même verrou", () => {
  assert.equal(paymentLockKey({ stripePaymentIntentId: "pi_A" }), paymentLockKey({ stripePaymentIntentId: "pi_A" }));
  assert.notEqual(paymentLockKey({ stripePaymentIntentId: "pi_A" }), paymentLockKey({ stripePaymentIntentId: "pi_B" }));
});

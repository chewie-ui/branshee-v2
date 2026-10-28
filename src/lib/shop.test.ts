import { test } from "node:test";
import assert from "node:assert/strict";
import { deliveryFee } from "./shop";

test("livraison", () => {
  assert.equal(deliveryFee(3000, { deliveryCents: 500, freeDeliveryFromCents: 5000 }), 500);
  assert.equal(deliveryFee(5000, { deliveryCents: 500, freeDeliveryFromCents: 5000 }), 0);
  assert.equal(deliveryFee(9999, { deliveryCents: 500, freeDeliveryFromCents: null }), 500);
});

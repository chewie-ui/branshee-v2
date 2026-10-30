import { test } from "node:test";
import assert from "node:assert/strict";
import { splitBeAddress } from "./address";

test("adresse belge d'un bloc", () => {
  assert.deepEqual(splitBeAddress("Rue de Namur 10, 1300 Wavre"), { street: "Rue de Namur 10", postalCode: "1300", city: "Wavre" });
  assert.deepEqual(splitBeAddress("Avenue des Bouleaux 9 1320 Beauvechain, Belgique"), { street: "Avenue des Bouleaux 9", postalCode: "1320", city: "Beauvechain" });
  assert.deepEqual(splitBeAddress("Chaussée de Bruxelles 5, B-1410 Waterloo"), { street: "Chaussée de Bruxelles 5", postalCode: "1410", city: "Waterloo" });
  assert.equal(splitBeAddress("Wavre"), null);
  assert.equal(splitBeAddress(""), null);
});

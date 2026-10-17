import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { decrypt, encrypt } from "./field-crypto";

describe("field-crypto", () => {
  before(() => {
    process.env.DATA_ENCRYPTION_KEY = "a".repeat(64);
  });
  it("chiffre puis déchiffre", () => {
    const enc = encrypt("Douleur lombaire depuis 3 semaines");
    assert.ok(enc?.startsWith("v1."));
    assert.equal(decrypt(enc), "Douleur lombaire depuis 3 semaines");
  });
  it("produit un chiffré différent à chaque fois", () => {
    assert.notEqual(encrypt("x"), encrypt("x"));
  });
  it("refuse un chiffré modifié", () => {
    const enc = encrypt("secret")!;
    const parts = enc.split(".");
    parts[3] = Buffer.from("autre").toString("base64url");
    assert.throws(() => decrypt(parts.join(".")));
  });
  it("laisse passer les valeurs vides", () => {
    assert.equal(encrypt(""), null);
    assert.equal(decrypt(null), null);
  });
});

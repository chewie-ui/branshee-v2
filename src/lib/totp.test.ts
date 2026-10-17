import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { base32Decode, base32Encode, totp, verifyTotp } from "./totp";

describe("totp", () => {
  // Vecteur RFC 6238 (secret ASCII « 12345678901234567890 »), T = 59 s → 94287082 → 287082 sur 6 chiffres.
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it("vecteurs RFC 6238", () => {
    assert.equal(totp(secret, 59_000), "287082");
    assert.equal(totp(secret, 1111111109_000), "081804");
  });
  it("base32 aller-retour", () => {
    assert.equal(base32Decode(secret).toString(), "12345678901234567890");
  });
  it("tolère une période de décalage", () => {
    assert.equal(verifyTotp(secret, totp(secret, 1_000_000_000_000 - 30_000), 1_000_000_000_000), true);
    assert.equal(verifyTotp(secret, totp(secret, 1_000_000_000_000 - 90_000), 1_000_000_000_000), false);
  });
});

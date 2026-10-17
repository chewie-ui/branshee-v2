import { describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { hashPassword, isLegacyHash, verifyPassword } from "./password";

describe("password", () => {
  it("vérifie un hash scrypt", async () => {
    const h = await hashPassword("motdepasse-solide");
    assert.ok(await verifyPassword("motdepasse-solide", h));
    assert.ok(!(await verifyPassword("mauvais", h)));
  });
  it("accepte les hash bcrypt de l'ancien Branshee", async () => {
    const legacy = await bcrypt.hash("ancien-mdp", 10);
    assert.ok(isLegacyHash(legacy));
    assert.ok(await verifyPassword("ancien-mdp", legacy));
    assert.ok(!(await verifyPassword("faux", legacy)));
  });
});

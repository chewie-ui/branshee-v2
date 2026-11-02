import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIp } from "./client-ip";

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

test("clientIp : la dernière valeur de X-Forwarded-For (ajoutée par Nginx) gagne", () => {
  assert.equal(clientIp(h({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" })), "1.2.3.4");
});

test("clientIp : un X-Real-IP envoyé par le visiteur ne remplace pas l'IP vue par Nginx", () => {
  assert.equal(clientIp(h({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.2.3.4" })), "1.2.3.4");
});

test("clientIp : X-Real-IP seulement en dernier recours", () => {
  assert.equal(clientIp(h({ "x-real-ip": "1.2.3.4" })), "1.2.3.4");
  assert.equal(clientIp(h({})), null);
});

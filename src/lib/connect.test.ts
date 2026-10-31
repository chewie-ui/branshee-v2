import { test } from "node:test";
import assert from "node:assert/strict";
import { hashKey, isPrivateIp, looksLikeKey, newApiKey, signPayload, verifySignature, webhookUrlProblem } from "./connect";

test("clé API : format, empreinte, préfixe", () => {
  const k = newApiKey();
  assert.ok(looksLikeKey(k.key));
  assert.equal(k.hash, hashKey(k.key));
  assert.equal(k.hash.length, 64);
  assert.ok(k.key.startsWith(k.prefix));
  assert.notEqual(newApiKey().key, k.key);
  assert.ok(!looksLikeKey("sk_live_court"));
});

test("signature des webhooks", () => {
  const body = JSON.stringify({ a: 1 });
  const { header, t } = signPayload("whsec_test", body, 1_800_000_000);
  assert.ok(verifySignature("whsec_test", body, header, t + 10));
  assert.ok(!verifySignature("whsec_autre", body, header, t + 10));
  assert.ok(!verifySignature("whsec_test", body + " ", header, t + 10));
  assert.ok(!verifySignature("whsec_test", body, header, t + 1000)); // trop vieux
  assert.ok(!verifySignature("whsec_test", body, "n'importe quoi", t));
});

test("adresses privées", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.1.1", "172.20.0.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "::ffff:127.0.0.1", "100.64.0.1"]) assert.ok(isPrivateIp(ip), ip);
  for (const ip of ["8.8.8.8", "51.38.1.2", "2a01:4f8::1"]) assert.ok(!isPrivateIp(ip), ip);
});

test("adresse de webhook", () => {
  assert.equal(webhookUrlProblem("https://monsite.be/api/skydev"), null);
  assert.ok(webhookUrlProblem("http://monsite.be/hook"));
  assert.ok(webhookUrlProblem("https://localhost/hook"));
  assert.ok(webhookUrlProblem("https://127.0.0.1/hook"));
  assert.ok(webhookUrlProblem("https://monsite.be:8080/hook"));
  assert.ok(webhookUrlProblem("https://user:pass@monsite.be/hook"));
  assert.ok(webhookUrlProblem("pas une url"));
});

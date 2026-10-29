import { test } from "node:test";
import assert from "node:assert/strict";
import { QR_STEP_MS, qrSign, qrVerify, qrWindow, sameDay } from "./loyalty-qr";

const K = "k".repeat(32);
const B = "11111111-1111-4111-8111-111111111111";

test("QR : valable 5 minutes, refusé ensuite, refusé pour une autre entreprise", () => {
  const now = 1_800_000_000_000;
  const w = qrWindow(now);
  const s = qrSign(K, B, w);
  assert.equal(qrVerify(K, B, w, s, now), true);
  assert.equal(qrVerify(K, B, w, s, now + 4 * 60_000), true);
  assert.equal(qrVerify(K, B, w, s, now + 6 * 60_000), false);
  assert.equal(qrVerify(K, "22222222-2222-4222-8222-222222222222", w, s, now), false);
  assert.equal(qrVerify(K, B, w + 1, qrSign(K, B, w + 1), now), false, "fenêtre future refusée");
  assert.equal(qrVerify(K, B, w, s.slice(0, -1) + "A", now), s.endsWith("A") ? true : false);
  assert.equal(qrVerify(K, B, w, "", now), false);
  assert.ok(QR_STEP_MS === 30_000);
});

test("Un tampon par jour, selon le fuseau", () => {
  const tz = "Europe/Brussels";
  assert.equal(sameDay(null, new Date(), tz), false);
  assert.equal(sameDay(new Date("2026-10-29T08:00:00Z"), new Date("2026-10-29T20:00:00Z"), tz), true);
  // 23h30 à Bruxelles le 29, puis 00h30 le 30 : deux jours différents.
  assert.equal(sameDay(new Date("2026-10-29T22:30:00Z"), new Date("2026-10-29T23:30:00Z"), tz), false);
});

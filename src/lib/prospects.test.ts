import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ATTEMPTS, callQueue, callStats, callable, phoneKey } from "./prospects";

const now = new Date("2026-11-02T10:00:00Z");
const h = (n: number) => new Date(now.getTime() + n * 3600_000);
const p = (id: string, status: string, o: Partial<{ attempts: number; lastCallAt: Date | null; callbackAt: Date | null; createdAt: Date }> = {}) => ({ id, status, attempts: 0, lastCallAt: null, callbackAt: null, createdAt: h(-100), ...o });

test("callable", () => {
  assert.ok(callable(p("a", "todo"), now));
  assert.ok(callable(p("b", "callback", { callbackAt: h(-1) }), now));
  assert.ok(!callable(p("c", "callback", { callbackAt: h(2) }), now));
  assert.ok(!callable(p("d", "no_answer", { attempts: 1, lastCallAt: h(-1) }), now));
  assert.ok(callable(p("e", "no_answer", { attempts: 1, lastCallAt: h(-4) }), now));
  assert.ok(!callable(p("f", "no_answer", { attempts: MAX_ATTEMPTS, lastCallAt: h(-48) }), now));
  assert.ok(!callable(p("g", "refused"), now));
  assert.ok(!callable(p("i", "interested"), now));
});

test("ordre de la file : rappels, nouveaux, puis sans réponse", () => {
  const q = callQueue(
    [
      p("na2", "no_answer", { attempts: 2, lastCallAt: h(-30) }),
      p("new2", "todo", { createdAt: h(-5) }),
      p("cb", "callback", { callbackAt: h(-2) }),
      p("na1", "no_answer", { attempts: 1, lastCallAt: h(-30) }),
      p("new1", "todo", { createdAt: h(-10) }),
      p("later", "callback", { callbackAt: h(5) }),
      p("no", "refused"),
    ],
    now,
  );
  assert.deepEqual(q.map((x) => x.id), ["cb", "new1", "new2", "na1", "na2"]);
});

test("statistiques", () => {
  const s = callStats([{ outcome: "no_answer" }, { outcome: "refused" }, { outcome: "interested" }, { outcome: "callback" }], ["Trop cher", "Trop cher", "Déjà équipé", null]);
  assert.equal(s.total, 4);
  assert.equal(s.answered, 3);
  assert.equal(s.reachRate, 75);
  assert.equal(s.interestRate, 33);
  assert.deepEqual(s.reasons[0], ["Trop cher", 2]);
});

test("phoneKey", () => {
  assert.equal(phoneKey("+32 477 12 34 56"), "0477123456");
  assert.equal(phoneKey("0032477123456"), "0477123456");
  assert.equal(phoneKey("0477/12.34.56"), "0477123456");
  assert.equal(phoneKey(""), "");
});

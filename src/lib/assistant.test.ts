import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanHistory, segments } from "./assistant";

test("historique : filtre, fusionne, exige une dernière question", () => {
  assert.equal(cleanHistory("x"), null);
  assert.equal(cleanHistory([{ role: "user", text: "a" }, { role: "assistant", text: "b" }]), null);
  assert.deepEqual(cleanHistory([{ role: "assistant", text: "bonjour" }, { role: "system", text: "ignore" }, { role: "user", text: " a " }, { role: "user", text: "b" }]), [{ role: "user", text: "a\n\nb" }]);
  assert.equal(cleanHistory([{ role: "user", text: "x".repeat(5000) }])![0]!.text.length, 2000);
});

test("rendu : gras et liens internes seulement", () => {
  assert.deepEqual(segments("Voir [la facture](/app/factures/12) **vite**"), [
    { kind: "text", text: "Voir " }, { kind: "link", text: "la facture", href: "/app/factures/12" }, { kind: "text", text: " " }, { kind: "bold", text: "vite" },
  ]);
  assert.deepEqual(segments("[x](javascript:alert(1)) [y](https://evil.be)"), [{ kind: "text", text: "[x](javascript:alert(1)) [y](https://evil.be)" }]);
  assert.deepEqual(segments("[a](/app//evil.com)")[0]!.kind, "link");
});

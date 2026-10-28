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

});

test("assistant : métiers de santé bloqués, sûr par défaut", async () => {
  const { assistantBlockedFor } = await import("./assistant");
  for (const t of [null, "", "ORL", "Chirurgien", "Radiologue", "Cabinet médical / Maison médicale", "Laboratoire d'analyses", "Maison de repos / Résidence services", "Pharmacie", "Logopède", "Audioprothésiste", "Physiothérapeute"]) assert.equal(assistantBlockedFor(t, false), true, String(t));
  for (const t of ["Coiffeur", "Institut de beauté", "Soins esthétiques", "Menuisier", "Restaurant", "Consultant", "Commerce", "Garage"]) assert.equal(assistantBlockedFor(t, false), false, t);
  assert.equal(assistantBlockedFor("Coiffeur", true), true);
});

test("liens : pas de sortie de /app", () => {
  assert.equal(segments("[x](/app/../auth/supervision/quitter)")[0]!.kind, "text");
  assert.equal(segments("[x](/app//evil)")[0]!.kind, "text");
});

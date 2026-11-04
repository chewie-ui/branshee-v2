import { test } from "node:test";
import assert from "node:assert/strict";
import { APPS } from "@/lib/apps";
import { METIERS, STORE_APPS, storeApps } from "@/lib/app-store";

test("chaque app active (hors Réglages) a sa fiche publique", () => {
  const ids = new Set(STORE_APPS.map((s) => s.id));
  for (const a of APPS) if (a.status === "active" && a.billing !== "system") assert.ok(ids.has(a.id), `fiche manquante : ${a.id}`);
});

test("adresses uniques et propres", () => {
  const slugs = STORE_APPS.map((s) => s.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of [...slugs, ...METIERS.map((m) => m.slug)]) assert.match(s, /^[a-z0-9-]+$/);
  assert.equal(new Set(METIERS.map((m) => m.slug)).size, METIERS.length);
});

test("les apps citées (métiers, « va bien avec ») existent", () => {
  const known = new Set(APPS.map((a) => a.id));
  for (const s of STORE_APPS) for (const id of s.avec) assert.ok(known.has(id), `${s.id} → ${id}`);
  for (const m of METIERS) for (const a of m.apps) assert.ok(known.has(a.id), `${m.slug} → ${a.id}`);
});

test("descriptions courtes pour Google", () => {
  for (const s of STORE_APPS) assert.ok(s.description.length <= 170, `${s.slug} : ${s.description.length}`);
  for (const m of METIERS) assert.ok(m.description.length <= 170, `${m.slug} : ${m.description.length}`);
  assert.ok(storeApps().length >= 20);
});

test("métier saisi → pack métier", async () => {
  const { metierForType, recommendedApps } = await import("@/lib/app-store");
  assert.equal(metierForType("Plombier")?.slug, "artisan");
  assert.equal(metierForType("Garagiste")?.slug, "garage");
  assert.equal(metierForType("Kinésithérapeute")?.slug, "kine");
  assert.equal(metierForType("Barbier")?.slug, "coiffure-beaute");
  assert.equal(metierForType("Restaurant italien")?.slug, "restaurant");
  assert.equal(metierForType("Menuisier")?.slug, "artisan");
  assert.equal(metierForType(""), null);
  assert.equal(metierForType("Astronaute"), null);
  assert.ok(recommendedApps("Garagiste").includes("vehicules"));
  assert.ok(!recommendedApps("Kiné").includes("vehicules"));
  assert.ok(recommendedApps(null).includes("factures"));
});

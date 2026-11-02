import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEquipment, formatPrice, formatRegistration, isVin, kwToHp, publicSpecs, vehicleSlug } from "./vehicles";

test("puissance kW → ch", () => {
  assert.equal(kwToHp(110), 150);
  assert.equal(kwToHp(81), 110);
});

test("prix : arrondi à l'euro, prix sur demande", () => {
  assert.match(formatPrice(1899000), /18[\s .]?990/);
  assert.equal(formatPrice(null), "Prix sur demande");
});

test("immatriculation AAAA-MM → MM/AAAA", () => {
  assert.equal(formatRegistration("2021-03"), "03/2021");
  assert.equal(formatRegistration("2021"), null);
});

test("adresse unique du véhicule", () => {
  const taken = new Set(["volkswagen-golf-1-5-tsi-2021"]);
  assert.equal(vehicleSlug({ make: "Volkswagen", model: "Golf", version: "1.5 TSI", firstRegistration: "2021-03" }, (s) => taken.has(s)), "volkswagen-golf-1-5-tsi-2021-2");
  assert.equal(vehicleSlug({ make: "Peugeot", model: "208" }, () => false), "peugeot-208");
});

test("équipements nettoyés sans doublon", () => {
  assert.deepEqual(cleanEquipment(["  GPS ", "gps", "", "Caméra   de recul"]), ["GPS", "Caméra de recul"]);
});

test("VIN : 17 caractères, sans I O Q", () => {
  assert.equal(isVin("WVWZZZ1KZAW000001"), true);
  assert.equal(isVin("WVWZZZ1KZAW00000I"), false);
  assert.equal(isVin("ABC"), false);
});

test("caractéristiques publiques : vides omises, libellés", () => {
  const rows = publicSpecs({ firstRegistration: "2020-06", mileageKm: 45000, fuel: "diesel", gearbox: null, powerKw: 85, engineCc: null, bodyType: "break", color: "Gris", interior: null, doors: 5, seats: null, co2: 0, euroNorm: null, owners: null });
  assert.deepEqual(rows.map((r) => r.label), ["1re immatriculation", "Kilométrage", "Carburant", "Puissance", "Carrosserie", "Couleur", "Portes", "Émissions CO₂"]);
  assert.equal(rows.find((r) => r.label === "Carburant")?.value, "Diesel");
});

test("prix tapé : milliers avec point ou espace", async () => {
  const { parseCarPrice } = await import("./vehicles");
  assert.equal(parseCarPrice("18990"), 1899000);
  assert.equal(parseCarPrice("18 990"), 1899000);
  assert.equal(parseCarPrice("18.990"), 1899000);
  assert.equal(parseCarPrice("18.990,50"), 1899050);
  assert.equal(parseCarPrice("18990.5"), 1899050);
  assert.equal(parseCarPrice("1.5.6"), null);
  assert.equal(parseCarPrice("abc"), null);
});

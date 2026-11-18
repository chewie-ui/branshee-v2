import { test } from "node:test";
import assert from "node:assert/strict";
import { buildKmehrReport, parseKmehr } from "./kmehr";

test("Kmehr : un rapport écrit se relit (aller-retour)", () => {
  const xml = buildKmehrReport({
    messageId: "abc", date: "2026-11-18", time: "10:00:00",
    sender: { inami: "5-12345-67-890", firstName: "Claire", lastName: "Horizon", practice: "Cabinet Horizon" },
    recipient: { inami: "1-23456-78-901", name: "Dr Martin" },
    patient: { niss: "85073003328", firstName: "Sophie", lastName: "Test & Co", birthDate: "1985-07-30", sex: "M" },
    title: "Rapport", text: "Évolution <favorable>.", language: "fr",
  });
  const k = parseKmehr(xml)!;
  assert.equal(k.patient.niss, "85073003328");
  assert.equal(k.patient.lastName, "Test & Co");
  assert.equal(k.patient.birthDate, "1985-07-30");
  assert.equal(k.patient.sex, "M");
  assert.equal(k.sender.inami, "51234567890");
  assert.equal(k.sender.name, "Claire Horizon");
  assert.ok(k.text.includes("Évolution <favorable>."));
});

test("Kmehr : préfixes d'espace de noms et message non Kmehr", () => {
  const xml = `<k:kmehrmessage xmlns:k="x"><k:header><k:date>2026-01-02</k:date><k:sender><k:hcparty><k:id S="ID-HCPARTY" SV="1.0">10000000001</k:id><k:familyname>Dupont</k:familyname></k:hcparty></k:sender></k:header><k:folder><k:patient><k:id S="ID-PATIENT" SV="1.0">85073003328</k:id><k:familyname>X</k:familyname></k:patient><k:transaction><k:text L="fr">Bonjour&#233;</k:text></k:transaction></k:folder></k:kmehrmessage>`;
  const k = parseKmehr(xml)!;
  assert.equal(k.date, "2026-01-02");
  assert.equal(k.sender.name, "Dupont");
  assert.equal(k.text, "Bonjouré");
  assert.equal(parseKmehr("<html></html>"), null);
});

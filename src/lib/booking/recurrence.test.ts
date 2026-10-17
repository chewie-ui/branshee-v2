import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isOccurrence, occurrences, parseVirtualSessionId, virtualSessionId } from "./recurrence";

const TZ = "Europe/Brussels";
describe("cours récurrents", () => {
  it("génère les lundis et jeudis à 18:00, changement d'heure compris", () => {
    const list = occurrences({ weekdays: [1, 4], startTime: "18:00" }, 60, new Date("2026-10-19T00:00:00Z"), new Date("2026-11-02T23:00:00Z"), TZ);
    assert.deepEqual(list.map((o) => o.startsAt.toISOString()), [
      "2026-10-19T16:00:00.000Z", // lundi, heure d'été (UTC+2)
      "2026-10-22T16:00:00.000Z",
      "2026-10-26T17:00:00.000Z", // après le passage à l'heure d'hiver (UTC+1)
      "2026-10-29T17:00:00.000Z",
      "2026-11-02T17:00:00.000Z",
    ]);
    assert.equal(list[0]!.endsAt.toISOString(), "2026-10-19T17:00:00.000Z");
  });
  it("vérifie qu'un instant est bien une séance du cours", () => {
    const rec = { weekdays: [1], startTime: "18:00" };
    assert.equal(isOccurrence(rec, new Date("2026-10-26T17:00:00Z"), TZ), true);
    assert.equal(isOccurrence(rec, new Date("2026-10-26T16:00:00Z"), TZ), false);
    assert.equal(isOccurrence(rec, new Date("2026-10-27T17:00:00Z"), TZ), false);
  });
  it("encode et décode l'identifiant d'une séance calculée", () => {
    const id = virtualSessionId("0f8f6a2e-1111-4a3b-9c2d-123456789abc", new Date("2026-10-26T17:00:00Z"));
    assert.deepEqual(parseVirtualSessionId(id), { serviceId: "0f8f6a2e-1111-4a3b-9c2d-123456789abc", startsAt: new Date("2026-10-26T17:00:00Z") });
    assert.equal(parseVirtualSessionId("r_pas-un-uuid_123"), null);
  });
});

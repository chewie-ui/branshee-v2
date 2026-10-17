import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeSlots, type SlotInput } from "./slots";

const TZ = "Europe/Brussels";
const MON = "2026-11-02"; // lundi, heure d'hiver (UTC+1)

function base(overrides: Partial<SlotInput> = {}): SlotInput {
  return {
    timezone: TZ,
    days: [MON],
    now: new Date("2026-11-01T12:00:00Z"),
    durationMin: 30,
    rules: { slotMode: "fixed", slotIntervalMin: 30, bufferBeforeMin: 0, bufferAfterMin: 0, minLeadMin: null, horizonDays: null },
    members: [{ memberId: "a", weekly: { 1: [{ start: "09:00", end: "11:00" }] }, exceptions: {} }],
    businessExceptions: {},
    busy: [],
    ...overrides,
  };
}
const times = (r: ReturnType<typeof computeSlots>, day = MON) => (r[day] ?? []).map((s) => s.time);

describe("computeSlots", () => {
  it("découpe les horaires en créneaux de la durée de la prestation", () => {
    assert.deepEqual(times(computeSlots(base())), ["09:00", "09:30", "10:00", "10:30"]);
  });

  it("convertit l'heure locale en instant UTC correct", () => {
    const [first] = computeSlots(base())[MON]!;
    assert.equal(first!.startsAt.toISOString(), "2026-11-02T08:00:00.000Z");
  });

  it("ne propose pas un créneau qui dépasse la fin de la plage", () => {
    assert.deepEqual(times(computeSlots(base({ durationMin: 45 }))), ["09:00", "09:45"]);
  });

  it("mode intervalle : départs tous les N minutes", () => {
    const r = computeSlots(base({ durationMin: 45, rules: { ...base().rules, slotMode: "interval", slotIntervalMin: 15 } }));
    assert.deepEqual(times(r), ["09:00", "09:15", "09:30", "09:45", "10:00", "10:15"]);
  });

  it("retire les créneaux qui chevauchent un RDV existant", () => {
    const busy = [{ memberId: "a", start: new Date("2026-11-02T08:30:00Z"), end: new Date("2026-11-02T09:00:00Z") }]; // 09:30–10:00 local
    assert.deepEqual(times(computeSlots(base({ busy }))), ["09:00", "10:00", "10:30"]);
  });

  it("applique le temps de battement avant et après", () => {
    const busy = [{ memberId: "a", start: new Date("2026-11-02T09:00:00Z"), end: new Date("2026-11-02T09:30:00Z") }]; // 10:00–10:30 local
    const r = computeSlots(base({ busy, rules: { ...base().rules, bufferAfterMin: 15, bufferBeforeMin: 15 } }));
    // 09:30–10:00 + 15 min après touche 10:00 → exclu ; 10:30 − 15 min avant touche 10:30 → exclu
    assert.deepEqual(times(r), ["09:00"]);
  });

  it("respecte le délai minimum avant réservation", () => {
    const now = new Date("2026-11-02T08:10:00Z"); // 09:10 local
    const r = computeSlots(base({ now, rules: { ...base().rules, minLeadMin: 60 } }));
    assert.deepEqual(times(r), ["10:30"]);
  });

  it("respecte l'horizon de réservation", () => {
    const r = computeSlots(base({ now: new Date("2026-10-20T12:00:00Z"), rules: { ...base().rules, horizonDays: 7 } }));
    assert.deepEqual(times(r), []);
  });

  it("une exception du membre remplace ses horaires", () => {
    const members = [{ memberId: "a", weekly: { 1: [{ start: "09:00", end: "11:00" }] }, exceptions: { [MON]: { isClosed: false, hours: [{ start: "14:00", end: "15:00" }] } } }];
    assert.deepEqual(times(computeSlots(base({ members }))), ["14:00", "14:30"]);
  });

  it("une fermeture de l'établissement bloque tout le monde", () => {
    assert.deepEqual(times(computeSlots(base({ businessExceptions: { [MON]: { isClosed: true, hours: [] } } }))), []);
  });

  it("regroupe les membres disponibles sur un même créneau", () => {
    const members = [
      { memberId: "a", weekly: { 1: [{ start: "09:00", end: "10:00" }] }, exceptions: {} },
      { memberId: "b", weekly: { 1: [{ start: "09:30", end: "10:30" }] }, exceptions: {} },
    ];
    const r = computeSlots(base({ members }))[MON]!;
    assert.deepEqual(
      r.map((s) => [s.time, s.memberIds]),
      [["09:00", ["a"]], ["09:30", ["a", "b"]], ["10:00", ["b"]]],
    );
  });

  it("gère le passage à l'heure d'été (29 mars 2026)", () => {
    const day = "2026-03-30"; // lundi après le changement : UTC+2
    const [first] = computeSlots(base({ days: [day], now: new Date("2026-03-01T00:00:00Z") }))[day]!;
    assert.equal(first!.startsAt.toISOString(), "2026-03-30T07:00:00.000Z");
  });

  describe("plages propres à la prestation", () => {
    const day = { memberId: "a", weekly: { 1: [{ start: "08:00", end: "16:00" }] }, exceptions: {} };

    it("ne propose la prestation que dans ses plages (ex. lundi avant 13 h)", () => {
      const r = computeSlots(base({ durationMin: 60, members: [day], serviceWindows: { 1: [{ start: "08:00", end: "13:00" }] } }));
      assert.deepEqual(times(r), ["08:00", "09:00", "10:00", "11:00", "12:00"]);
    });

    it("recale la grille sur le début de la plage de la prestation", () => {
      const r = computeSlots(base({ durationMin: 45, members: [day], serviceWindows: { 1: [{ start: "13:00", end: "16:00" }] } }));
      assert.deepEqual(times(r), ["13:00", "13:45", "14:30", "15:15"]);
    });

    it("jour absent des plages = prestation non proposée ce jour-là", () => {
      const r = computeSlots(base({ members: [day], serviceWindows: { 2: [{ start: "08:00", end: "16:00" }] } }));
      assert.deepEqual(times(r), []);
    });

    it("reste limitée aux horaires du praticien", () => {
      const r = computeSlots(base({ durationMin: 60, members: [day], serviceWindows: { 1: [{ start: "14:00", end: "20:00" }] } }));
      assert.deepEqual(times(r), ["14:00", "15:00"]);
    });
  });
});

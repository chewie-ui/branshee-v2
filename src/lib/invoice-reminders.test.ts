import { test } from "node:test";
import assert from "node:assert/strict";
import { clampRule, DEFAULT_RULE, reminderDue } from "./invoice-reminders";

test("relances : délai, rythme, plafond", () => {
  const r = DEFAULT_RULE;
  assert.equal(reminderDue({ dueDate: null, remindersSent: 0, lastReminderDay: null }, r, "2026-10-20"), false);
  assert.equal(reminderDue({ dueDate: "2026-10-18", remindersSent: 0, lastReminderDay: null }, r, "2026-10-20"), false);
  assert.equal(reminderDue({ dueDate: "2026-10-17", remindersSent: 0, lastReminderDay: null }, r, "2026-10-20"), true);
  assert.equal(reminderDue({ dueDate: "2026-10-01", remindersSent: 1, lastReminderDay: "2026-10-15" }, r, "2026-10-21"), false);
  assert.equal(reminderDue({ dueDate: "2026-10-01", remindersSent: 1, lastReminderDay: "2026-10-15" }, r, "2026-10-22"), true);
  assert.equal(reminderDue({ dueDate: "2026-09-01", remindersSent: 3, lastReminderDay: "2026-09-20" }, r, "2026-10-22"), false);
  assert.equal(reminderDue({ dueDate: "2026-12-25", remindersSent: 0, lastReminderDay: null }, r, "2027-01-02"), true);
});

test("relances : réglages bornés", () => {
  assert.deepEqual(clampRule({ firstDays: 0, everyDays: 1, maxReminders: 99 }), { firstDays: 3, everyDays: 3, maxReminders: 5 });
  assert.deepEqual(clampRule({ firstDays: 10, everyDays: 14, maxReminders: 2 }), { firstDays: 10, everyDays: 14, maxReminders: 2 });
});

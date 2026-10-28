/** Relances automatiques des factures échues (pur, testé). Dates au format AAAA-MM-JJ. */
export type ReminderRule = { firstDays: number; everyDays: number; maxReminders: number };
export const DEFAULT_RULE: ReminderRule = { firstDays: 3, everyDays: 7, maxReminders: 3 };

const day = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const DAY = 86400_000;

/** Faut-il relancer aujourd'hui ? `lastReminderDay` = jour (local) de la dernière relance. */
export function reminderDue(p: { dueDate: string | null; remindersSent: number; lastReminderDay: string | null }, rule: ReminderRule, today: string) {
  if (!p.dueDate || p.remindersSent >= rule.maxReminders) return false;
  const late = (day(today) - day(p.dueDate)) / DAY;
  if (late < rule.firstDays) return false;
  if (!p.lastReminderDay) return true;
  return (day(today) - day(p.lastReminderDay)) / DAY >= rule.everyDays;
}

/** Bornes raisonnables pour les réglages. */
export const clampRule = (r: Partial<ReminderRule>): ReminderRule => ({
  firstDays: Math.min(60, Math.max(1, Math.round(Number(r.firstDays) || DEFAULT_RULE.firstDays))),
  everyDays: Math.min(60, Math.max(3, Math.round(Number(r.everyDays) || DEFAULT_RULE.everyDays))),
  maxReminders: Math.min(5, Math.max(1, Math.round(Number(r.maxReminders) || DEFAULT_RULE.maxReminders))),
});

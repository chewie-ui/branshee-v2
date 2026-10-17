import { TZDate } from "@date-fns/tz";
import type { TimeRange } from "@/db/schema/_shared";

/**
 * Moteur de calcul des créneaux disponibles — fonction pure, sans accès base.
 * Toute la logique « quand peut-on réserver ? » est ici, testée dans slots.test.ts.
 */

export type DayException = { isClosed: boolean; hours: TimeRange[] };

export type MemberAvailability = {
  memberId: string;
  /** Plages hebdomadaires indexées par jour (0 = dimanche … 6 = samedi). */
  weekly: Record<number, TimeRange[]>;
  /** Exceptions propres au membre, par date "YYYY-MM-DD". */
  exceptions: Record<string, DayException>;
};

export type BusyInterval = { memberId: string; start: Date; end: Date };

export type SlotRules = {
  slotMode: "fixed" | "interval";
  /** Pas entre deux départs en mode « intervalle ». */
  slotIntervalMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  /** Délai minimum avant un RDV (null = aucun). */
  minLeadMin: number | null;
  /** Réservable jusqu'à N jours (null = illimité). */
  horizonDays: number | null;
};

export type SlotInput = {
  timezone: string;
  /** Jours demandés, "YYYY-MM-DD", dans le fuseau de l'établissement. */
  days: string[];
  now: Date;
  durationMin: number;
  rules: SlotRules;
  members: MemberAvailability[];
  /** Exceptions qui s'appliquent à tout l'établissement (fermeture, jour férié…). */
  businessExceptions: Record<string, DayException>;
  busy: BusyInterval[];
};

export type Slot = { time: string; startsAt: Date; endsAt: Date; memberIds: string[] };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function dayParts(day: string) {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

/** Instant exact d'une heure locale "HH:MM" à une date donnée, dans le fuseau (gère les changements d'heure). */
function at(day: string, minutes: number, timezone: string): Date {
  const { y, m, d } = dayParts(day);
  return new Date(new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, timezone).getTime());
}

function weekdayOf(day: string, timezone: string) {
  const { y, m, d } = dayParts(day);
  return new TZDate(y, m - 1, d, 12, 0, 0, timezone).getDay();
}

/**
 * Plages de travail effectives d'un membre pour un jour.
 * Priorité : exception du membre > exception de l'établissement > horaires hebdomadaires.
 */
export function workingRanges(member: MemberAvailability, day: string, timezone: string, businessExceptions: Record<string, DayException>): TimeRange[] {
  const own = member.exceptions[day];
  if (own) return own.isClosed ? [] : own.hours;
  const biz = businessExceptions[day];
  if (biz) return biz.isClosed ? [] : biz.hours;
  return member.weekly[weekdayOf(day, timezone)] ?? [];
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

export function computeSlots(input: SlotInput): Record<string, Slot[]> {
  const { timezone, rules, durationMin } = input;
  const out: Record<string, Slot[]> = {};
  if (durationMin <= 0) return out;

  const earliest = input.now.getTime() + (rules.minLeadMin ?? 0) * 60000;
  const latest = rules.horizonDays != null ? input.now.getTime() + rules.horizonDays * 86400000 : Infinity;
  const step = rules.slotMode === "interval" ? Math.max(5, rules.slotIntervalMin) : durationMin;
  const before = rules.bufferBeforeMin * 60000;
  const after = rules.bufferAfterMin * 60000;

  const busyByMember = new Map<string, { start: number; end: number }[]>();
  for (const b of input.busy) {
    const list = busyByMember.get(b.memberId) ?? [];
    list.push({ start: b.start.getTime(), end: b.end.getTime() });
    busyByMember.set(b.memberId, list);
  }

  for (const day of input.days) {
    const byStart = new Map<number, Slot>();

    for (const member of input.members) {
      const busy = busyByMember.get(member.memberId) ?? [];
      for (const range of workingRanges(member, day, timezone, input.businessExceptions)) {
        const rStart = toMin(range.start);
        const rEnd = toMin(range.end);
        for (let t = rStart; t + durationMin <= rEnd; t += step) {
          const startsAt = at(day, t, timezone);
          const endsAt = at(day, t + durationMin, timezone);
          const s = startsAt.getTime();
          if (s < earliest || s > latest) continue;
          // Le temps de battement s'ajoute autour du nouveau RDV : il ne doit toucher aucun RDV existant.
          if (busy.some((b) => overlaps(s - before, endsAt.getTime() + after, b.start, b.end))) continue;

          const existing = byStart.get(s);
          if (existing) existing.memberIds.push(member.memberId);
          else byStart.set(s, { time: toHHMM(t), startsAt, endsAt, memberIds: [member.memberId] });
        }
      }
    }

    out[day] = [...byStart.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }
  return out;
}

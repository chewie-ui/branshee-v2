import "server-only";
import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, groupSessions, members, services } from "@/db/schema";

const bookedCount = sql<number>`(select count(*)::int from ${appointments} where ${appointments.groupSessionId} = ${groupSessions.id} and ${appointments.status} <> 'cancelled')`;

/** Séances d'une prestation (côté pro), avec le nombre d'inscrits. */
export async function listServiceSessions(serviceId: string, from: Date, opts: { includeCancelled?: boolean } = {}) {
  const where = [eq(groupSessions.serviceId, serviceId), gte(groupSessions.endsAt, from)];
  if (!opts.includeCancelled) where.push(isNull(groupSessions.cancelledAt));
  return db
    .select({ id: groupSessions.id, startsAt: groupSessions.startsAt, endsAt: groupSessions.endsAt, capacity: groupSessions.capacity, cancelledAt: groupSessions.cancelledAt, memberId: groupSessions.memberId, memberName: members.displayName, booked: bookedCount })
    .from(groupSessions)
    .leftJoin(members, eq(members.id, groupSessions.memberId))
    .where(and(...where))
    .orderBy(asc(groupSessions.startsAt))
    .limit(200);
}

export type PublicSession = { id: string; startsAt: string; endsAt: string; remaining: number | null; memberName: string | null };

/**
 * Séances à venir réservables en ligne, groupées par prestation.
 * Respecte le délai minimum et l'horizon de réservation de l'établissement.
 */
export async function listPublicSessions(serviceIds: string[], window: { from: Date; to: Date | null }) {
  if (serviceIds.length === 0) return {} as Record<string, PublicSession[]>;
  const where = [inArray(groupSessions.serviceId, serviceIds), isNull(groupSessions.cancelledAt), gte(groupSessions.startsAt, window.from)];
  if (window.to) where.push(lte(groupSessions.startsAt, window.to));
  const rows = await db
    .select({ id: groupSessions.id, serviceId: groupSessions.serviceId, startsAt: groupSessions.startsAt, endsAt: groupSessions.endsAt, capacity: groupSessions.capacity, serviceCapacity: services.capacity, memberName: members.displayName, booked: bookedCount })
    .from(groupSessions)
    .innerJoin(services, eq(services.id, groupSessions.serviceId))
    .leftJoin(members, eq(members.id, groupSessions.memberId))
    .where(and(...where))
    .orderBy(asc(groupSessions.startsAt))
    .limit(300);
  const out: Record<string, PublicSession[]> = {};
  for (const r of rows) {
    const cap = r.capacity ?? r.serviceCapacity;
    (out[r.serviceId] ??= []).push({ id: r.id, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString(), remaining: cap == null ? null : Math.max(0, cap - r.booked), memberName: r.memberName });
  }
  return out;
}

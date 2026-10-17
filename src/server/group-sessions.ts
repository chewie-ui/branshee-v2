import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, groupSessions, members, serviceMembers, services } from "@/db/schema";
import { occurrences, virtualSessionId, type Recurrence } from "@/lib/booking/recurrence";

const bookedCount = sql<number>`(select count(*)::int from ${appointments} where ${appointments.groupSessionId} = ${groupSessions.id} and ${appointments.status} <> 'cancelled')`;

export type SessionView = {
  /** uuid d'une séance enregistrée, ou « r_… » pour une séance récurrente pas encore enregistrée. */
  id: string;
  serviceId: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  booked: number;
  cancelled: boolean;
  memberId: string | null;
  memberName: string | null;
  virtual: boolean;
};

type GroupService = { id: string; durationMin: number; capacity: number | null; recurrence: Recurrence | null };

/**
 * Séances d'un ou plusieurs cours sur une période : celles enregistrées en base, plus les séances
 * récurrentes calculées (une séance enregistrée — inscription, annulation — remplace la séance calculée).
 */
export async function sessionsFor(svcs: GroupService[], window: { from: Date; to: Date }, timezone: string, opts: { includeCancelled?: boolean } = {}): Promise<SessionView[]> {
  if (svcs.length === 0) return [];
  const rows = await db
    .select({ g: groupSessions, memberName: members.displayName, booked: bookedCount })
    .from(groupSessions)
    .leftJoin(members, eq(members.id, groupSessions.memberId))
    .where(and(inArray(groupSessions.serviceId, svcs.map((s) => s.id)), gte(groupSessions.startsAt, window.from), lte(groupSessions.startsAt, window.to)))
    .orderBy(asc(groupSessions.startsAt));

  const stored: SessionView[] = rows.map(({ g, memberName, booked }) => ({
    id: g.id,
    serviceId: g.serviceId,
    startsAt: g.startsAt,
    endsAt: g.endsAt,
    capacity: g.capacity ?? svcs.find((s) => s.id === g.serviceId)?.capacity ?? null,
    booked,
    cancelled: g.cancelledAt != null,
    memberId: g.memberId,
    memberName,
    virtual: false,
  }));
  const taken = new Set(stored.map((s) => `${s.serviceId}:${s.startsAt.getTime()}`));

  // Animateur par défaut d'un cours récurrent : le premier membre assigné à la prestation.
  const recurring = svcs.filter((s) => s.recurrence?.weekdays.length);
  const leads = recurring.length
    ? await db.select({ serviceId: serviceMembers.serviceId, memberId: members.id, name: members.displayName }).from(serviceMembers).innerJoin(members, eq(members.id, serviceMembers.memberId)).where(inArray(serviceMembers.serviceId, recurring.map((s) => s.id)))
    : [];

  const computed: SessionView[] = recurring.flatMap((s) =>
    occurrences(s.recurrence!, s.durationMin, window.from, window.to, timezone)
      .filter((o) => !taken.has(`${s.id}:${o.startsAt.getTime()}`))
      .map((o) => {
        const lead = leads.find((l) => l.serviceId === s.id);
        return { id: virtualSessionId(s.id, o.startsAt), serviceId: s.id, startsAt: o.startsAt, endsAt: o.endsAt, capacity: s.capacity, booked: 0, cancelled: false, memberId: lead?.memberId ?? null, memberName: lead?.name ?? null, virtual: true };
      }),
  );

  return [...stored, ...computed].filter((s) => opts.includeCancelled || !s.cancelled).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export async function groupServicesOf(businessId: string, serviceIds?: string[]) {
  const where = [eq(services.businessId, businessId), eq(services.kind, "group")];
  if (serviceIds) where.push(inArray(services.id, serviceIds));
  return db.select({ id: services.id, name: services.name, color: services.color, durationMin: services.durationMin, capacity: services.capacity, recurrence: services.recurrence, blocksIndividual: services.blocksIndividual, isActive: services.isActive }).from(services).where(and(...where));
}

/** Séances d'un cours (côté pro), avec le nombre d'inscrits. */
export async function listServiceSessions(service: GroupService, from: Date, timezone: string, weeks = 8) {
  return sessionsFor([service], { from, to: new Date(from.getTime() + weeks * 7 * 86400000) }, timezone);
}

export type PublicSession = { id: string; startsAt: string; endsAt: string; remaining: number | null; memberName: string | null };

/** Séances à venir réservables en ligne (délai minimum et horizon de réservation respectés). */
export async function listPublicSessions(businessId: string, serviceId: string, window: { from: Date; to: Date }, timezone: string): Promise<PublicSession[]> {
  const [svc] = await groupServicesOf(businessId, [serviceId]);
  if (!svc || !svc.isActive) return [];
  const list = await sessionsFor([svc], window, timezone);
  return list.map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), remaining: s.capacity == null ? null : Math.max(0, s.capacity - s.booked), memberName: s.memberName }));
}

/**
 * Créneaux occupés par les cours qui bloquent les RDV individuels, pour le calcul des disponibilités.
 * Animateurs : membre de la séance, sinon membres assignés au cours, sinon toute l'équipe.
 */
export async function groupBusy(businessId: string, memberIds: string[], window: { from: Date; to: Date }, timezone: string) {
  const svcs = (await groupServicesOf(businessId)).filter((s) => s.blocksIndividual);
  if (!svcs.length || !memberIds.length) return [];
  const [sessions, links] = await Promise.all([
    sessionsFor(svcs, window, timezone),
    db.select({ serviceId: serviceMembers.serviceId, memberId: serviceMembers.memberId }).from(serviceMembers).where(inArray(serviceMembers.serviceId, svcs.map((s) => s.id))),
  ]);
  return sessions.flatMap((s) => {
    const who = s.memberId && !s.virtual ? [s.memberId] : links.filter((l) => l.serviceId === s.serviceId).map((l) => l.memberId);
    const targets = (who.length ? who : memberIds).filter((id) => memberIds.includes(id));
    return targets.map((memberId) => ({ memberId, start: s.startsAt, end: s.endsAt }));
  });
}

/** Enregistre en base une séance récurrente (sans doublon grâce à l'index unique) et renvoie son id. */
export async function materializeSession(tx: Pick<typeof db, "insert" | "select">, serviceId: string, startsAt: Date, endsAt: Date, memberId: string | null) {
  const [created] = await tx.insert(groupSessions).values({ serviceId, startsAt, endsAt, memberId }).onConflictDoNothing().returning({ id: groupSessions.id });
  if (created) return created.id;
  const [existing] = await tx.select({ id: groupSessions.id }).from(groupSessions).where(and(eq(groupSessions.serviceId, serviceId), eq(groupSessions.startsAt, startsAt)));
  return existing!.id;
}

/** Nombre de séances annulées à venir (pour information côté pro). */
export async function countCancelled(serviceId: string, from: Date) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(groupSessions).where(and(eq(groupSessions.serviceId, serviceId), isNotNull(groupSessions.cancelledAt), gte(groupSessions.startsAt, from)));
  return r?.n ?? 0;
}

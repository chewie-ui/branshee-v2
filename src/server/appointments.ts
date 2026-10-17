import "server-only";
import { and, asc, count, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, customers, groupSessions, members, services } from "@/db/schema";

export type AgendaItem = {
  id: string;
  kind: "appointment" | "block" | "group";
  status: "pending" | "confirmed" | "cancelled";
  startsAt: Date;
  endsAt: Date;
  title: string;
  serviceName: string | null;
  color: string | null;
  memberId: string | null;
  memberName: string | null;
  customerId: string | null;
  phone: string | null;
  internalNote: string | null;
  /** Page de détail (RDV ou séance de cours collectif). */
  href: string;
};

/** RDV et blocages d'une période (annulés exclus par défaut). */
export async function listAppointments(businessId: string, start: Date, end: Date, opts: { includeCancelled?: boolean; memberId?: string } = {}): Promise<AgendaItem[]> {
  // Les participants d'un cours collectif ne sont pas listés un par un : la séance apparaît une seule fois.
  const where = [eq(appointments.businessId, businessId), gte(appointments.startsAt, start), lt(appointments.startsAt, end), isNull(appointments.groupSessionId)];
  if (!opts.includeCancelled) where.push(ne(appointments.status, "cancelled"));
  if (opts.memberId) where.push(eq(appointments.memberId, opts.memberId));

  const rows = await db
    .select({
      a: appointments,
      memberName: members.displayName,
      customerName: customers.fullName,
    })
    .from(appointments)
    .leftJoin(members, eq(members.id, appointments.memberId))
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .where(and(...where))
    .orderBy(asc(appointments.startsAt));

  const items: AgendaItem[] = rows.map(({ a, memberName, customerName }) => ({
    id: a.id,
    kind: a.kind,
    status: a.status,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    title: a.kind === "block" ? (a.internalNote || "Créneau bloqué") : (customerName ?? a.contactName ?? "Client"),
    serviceName: a.serviceName,
    color: a.serviceColor,
    memberId: a.memberId,
    memberName,
    customerId: a.customerId,
    phone: a.contactPhone,
    internalNote: a.internalNote,
    href: `/app/agenda/rdv/${a.id}`,
  }));
  const sessions = await listGroupSessionItems(businessId, start, end, opts);
  return [...items, ...sessions].sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime());
}

async function listGroupSessionItems(businessId: string, start: Date, end: Date, opts: { includeCancelled?: boolean; memberId?: string }): Promise<AgendaItem[]> {
  const where = [eq(services.businessId, businessId), gte(groupSessions.startsAt, start), lt(groupSessions.startsAt, end)];
  if (!opts.includeCancelled) where.push(isNull(groupSessions.cancelledAt));
  if (opts.memberId) where.push(eq(groupSessions.memberId, opts.memberId));
  const rows = await db
    .select({
      g: groupSessions,
      serviceId: services.id,
      serviceName: services.name,
      color: services.color,
      capacity: services.capacity,
      memberName: members.displayName,
      booked: sql<number>`(select count(*)::int from ${appointments} where ${appointments.groupSessionId} = ${groupSessions.id} and ${appointments.status} <> 'cancelled')`,
    })
    .from(groupSessions)
    .innerJoin(services, eq(services.id, groupSessions.serviceId))
    .leftJoin(members, eq(members.id, groupSessions.memberId))
    .where(and(...where));
  return rows.map((r) => {
    const cap = r.g.capacity ?? r.capacity;
    return {
      id: r.g.id,
      kind: "group" as const,
      status: r.g.cancelledAt ? ("cancelled" as const) : ("confirmed" as const),
      startsAt: r.g.startsAt,
      endsAt: r.g.endsAt,
      title: `${r.serviceName} · ${r.booked}${cap ? `/${cap}` : ""}`,
      serviceName: r.serviceName,
      color: r.color,
      memberId: r.g.memberId,
      memberName: r.memberName,
      customerId: null,
      phone: null,
      internalNote: null,
      href: `/app/prestations/${r.serviceId}/seances/${r.g.id}`,
    };
  });
}

export async function listPendingRequests(businessId: string, from: Date) {
  return (await listAppointments(businessId, from, new Date(from.getTime() + 365 * 86400000))).filter((a) => a.status === "pending" && a.kind === "appointment");
}

export async function countAppointments(businessId: string, start: Date, end: Date) {
  const [row] = await db
    .select({ n: count() })
    .from(appointments)
    .where(and(eq(appointments.businessId, businessId), eq(appointments.kind, "appointment"), ne(appointments.status, "cancelled"), gte(appointments.startsAt, start), lt(appointments.startsAt, end)));
  return row?.n ?? 0;
}

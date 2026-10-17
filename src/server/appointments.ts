import "server-only";
import { and, asc, count, eq, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, customers, members } from "@/db/schema";

export type AgendaItem = {
  id: string;
  kind: "appointment" | "block";
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
};

/** RDV et blocages d'une période (annulés exclus par défaut). */
export async function listAppointments(businessId: string, start: Date, end: Date, opts: { includeCancelled?: boolean; memberId?: string } = {}): Promise<AgendaItem[]> {
  const where = [eq(appointments.businessId, businessId), gte(appointments.startsAt, start), lt(appointments.startsAt, end)];
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

  return rows.map(({ a, memberName, customerName }) => ({
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
  }));
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

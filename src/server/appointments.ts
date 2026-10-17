import "server-only";
import { and, asc, count, eq, gte, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, businesses, customers, members } from "@/db/schema";
import { groupServicesOf, sessionsFor } from "@/server/group-sessions";

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
  // Filtre par membre : ses RDV, plus les blocages de tout l'établissement.
  if (opts.memberId) where.push(or(eq(appointments.memberId, opts.memberId), and(isNull(appointments.memberId), eq(appointments.kind, "block")))!);

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
    href: a.kind === "block" ? `/app/agenda/bloquer?id=${a.id}` : `/app/agenda/rdv/${a.id}`,
  }));
  const sessions = await listGroupSessionItems(businessId, start, end, opts);
  return [...items, ...sessions].sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime());
}

async function listGroupSessionItems(businessId: string, start: Date, end: Date, opts: { includeCancelled?: boolean; memberId?: string }): Promise<AgendaItem[]> {
  const svcs = await groupServicesOf(businessId);
  if (!svcs.length) return [];
  const [biz] = await db.select({ tz: businesses.timezone }).from(businesses).where(eq(businesses.id, businessId));
  const list = await sessionsFor(svcs, { from: start, to: new Date(end.getTime() - 1) }, biz?.tz ?? "Europe/Brussels", { includeCancelled: opts.includeCancelled });
  return list
    .filter((s) => !opts.memberId || s.memberId === opts.memberId)
    .map((s) => {
      const svc = svcs.find((x) => x.id === s.serviceId)!;
      return {
        id: s.id,
        kind: "group" as const,
        status: s.cancelled ? ("cancelled" as const) : ("confirmed" as const),
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        title: `${svc.name} · ${s.booked}${s.capacity ? `/${s.capacity}` : ""}`,
        serviceName: svc.name,
        color: svc.color,
        memberId: s.memberId,
        memberName: s.memberName,
        customerId: null,
        phone: null,
        internalNote: null,
        href: `/app/prestations/${s.serviceId}/seances/${s.id}`,
      };
    });
}
/** Demandes en attente (y compris celles dont la date est passée, à libérer). */
export async function listPendingRequests(businessId: string) {
  const rows = await db
    .select({ a: appointments, memberName: members.displayName })
    .from(appointments)
    .leftJoin(members, eq(members.id, appointments.memberId))
    .where(and(eq(appointments.businessId, businessId), eq(appointments.status, "pending"), eq(appointments.kind, "appointment")))
    .orderBy(asc(appointments.startsAt));
  return rows.map(({ a, memberName }) => ({
    id: a.id,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    title: a.contactName ?? "Client",
    serviceName: a.serviceName,
    color: a.serviceColor,
    memberName,
    email: a.contactEmail,
    phone: a.contactPhone,
    message: a.customerMessage,
    customerId: a.customerId,
  }));
}

export async function countPendingRequests(businessId: string) {
  const [row] = await db.select({ n: count() }).from(appointments).where(and(eq(appointments.businessId, businessId), eq(appointments.status, "pending"), eq(appointments.kind, "appointment"), gte(appointments.startsAt, new Date())));
  return row?.n ?? 0;
}

export async function countAppointments(businessId: string, start: Date, end: Date) {
  const [row] = await db
    .select({ n: count() })
    .from(appointments)
    .where(and(eq(appointments.businessId, businessId), eq(appointments.kind, "appointment"), ne(appointments.status, "cancelled"), gte(appointments.startsAt, start), lt(appointments.startsAt, end)));
  return row?.n ?? 0;
}

import { and, eq, gte, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, businesses, members } from "@/db/schema";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line: string) => (line.length <= 74 ? line : line.match(/.{1,73}/g)!.join("\r\n "));

/**
 * Flux d'agenda personnel (abonnement depuis Google Agenda, Apple Calendrier, Outlook).
 * Même adresse que l'ancien Branshee (/ical/<jeton>) : les abonnements existants continuent.
 * Propriétaire : tous les RDV de l'établissement ; collaborateur : les siens. Nom + prestation seulement.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{16,128}$/.test(token)) return new Response("Flux introuvable.", { status: 404 });
  const [m] = await db.select({ m: members, bizName: businesses.name }).from(members).innerJoin(businesses, eq(businesses.id, members.businessId)).where(eq(members.calendarFeedToken, token));
  if (!m || m.m.status !== "active") return new Response("Flux introuvable.", { status: 404 });
  const since = new Date();
  since.setMonth(since.getMonth() - 3);
  const rows = await db
    .select({ id: appointments.id, startsAt: appointments.startsAt, endsAt: appointments.endsAt, name: appointments.contactName, service: appointments.serviceName, status: appointments.status, kind: appointments.kind, member: members.displayName })
    .from(appointments)
    .leftJoin(members, eq(members.id, appointments.memberId))
    .where(and(eq(appointments.businessId, m.m.businessId), ne(appointments.status, "cancelled"), gte(appointments.startsAt, since), m.m.isOwner ? undefined : eq(appointments.memberId, m.m.id)))
    .limit(5000);
  const now = stamp(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Branshee//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(`${m.bizName} — Rendez-vous`)}`, "X-PUBLISHED-TTL:PT15M"];
  for (const r of rows) {
    const title = r.kind === "block" ? "Indisponible" : `${r.name ?? "Client"}${r.service ? ` · ${r.service}` : ""}${r.status === "pending" ? " (à confirmer)" : ""}`;
    lines.push("BEGIN:VEVENT", `UID:${r.id}@branshee`, `DTSTAMP:${now}`, `DTSTART:${stamp(r.startsAt)}`, `DTEND:${stamp(r.endsAt)}`, fold(`SUMMARY:${esc(title)}`), ...(m.m.isOwner && r.member ? [fold(`DESCRIPTION:${esc(`Avec ${r.member}`)}`)] : []), "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" } });
}

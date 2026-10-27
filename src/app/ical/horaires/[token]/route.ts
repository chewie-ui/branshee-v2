import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { businesses, members, shifts } from "@/db/schema";
import { addDays, overnight } from "@/lib/planning";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line: string) => (line.length <= 74 ? line : line.match(/.{1,73}/g)!.join("\r\n "));
const local = (day: string, time: string) => `${day.replace(/-/g, "")}T${time.slice(0, 5).replace(":", "")}00`;

/**
 * Planning en flux d'agenda (Google Agenda, Apple Calendrier, Outlook), avec le jeton personnel du membre.
 * Membre : ses horaires. Responsable : ceux de toute l'équipe, avec le nom de chacun.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{16,128}$/.test(token)) return new Response("Flux introuvable.", { status: 404 });
  const [m] = await db.select({ m: members, biz: businesses }).from(members).innerJoin(businesses, eq(businesses.id, members.businessId)).where(eq(members.calendarFeedToken, token));
  if (!m || m.m.status !== "active" || !m.m.isActive || m.biz.deletedAt) return new Response("Flux introuvable.", { status: 404 });
  const since = new Date();
  since.setMonth(since.getMonth() - 2);
  const from = since.toISOString().slice(0, 10);
  const rows = await db
    .select({ s: shifts, name: members.displayName })
    .from(shifts)
    .innerJoin(members, eq(members.id, shifts.memberId))
    .where(and(eq(shifts.businessId, m.m.businessId), gte(shifts.day, from), m.m.isOwner ? undefined : eq(shifts.memberId, m.m.id)))
    .orderBy(asc(shifts.day))
    .limit(5000);
  const tz = m.biz.timezone || "Europe/Brussels";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Skydev//Planning//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(`${m.biz.name} — Planning`)}`, `X-WR-TIMEZONE:${tz}`, "X-PUBLISHED-TTL:PT30M"];
  for (const { s, name } of rows) {
    const endDay = overnight(s.startTime, s.endTime) ? addDays(s.day, 1) : s.day;
    const title = `${m.m.isOwner ? `${name} · ` : ""}${s.label ?? "Travail"}`;
    const desc = [s.breakMinutes ? `Pause : ${s.breakMinutes} min` : "", s.note ?? ""].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", `UID:${s.id}@skydev-planning`, `DTSTAMP:${stamp}`, `DTSTART;TZID=${tz}:${local(s.day, s.startTime)}`, `DTEND;TZID=${tz}:${local(endDay, s.endTime)}`, fold(`SUMMARY:${esc(title)}`), ...(desc ? [fold(`DESCRIPTION:${esc(desc)}`)] : []), "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" } });
}

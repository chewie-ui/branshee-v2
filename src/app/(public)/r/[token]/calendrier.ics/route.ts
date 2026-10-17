import { getAppointmentByToken } from "@/server/manage";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fichier .ics pour ajouter le RDV à Google Agenda, Apple Calendrier ou Outlook. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const row = await getAppointmentByToken((await params).token);
  if (!row || row.a.status === "cancelled") return new Response("Introuvable", { status: 404 });
  const { a, business: b, memberName } = row;
  const address = [b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Branshee//RDV//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${a.id}@branshee`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(a.startsAt)}`,
    `DTEND:${stamp(a.endsAt)}`,
    `SUMMARY:${esc(`${a.serviceName ?? "Rendez-vous"} — ${b.name}`)}`,
    memberName ? `DESCRIPTION:${esc(`Avec ${memberName}`)}` : null,
    address ? `LOCATION:${esc(address)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="rendez-vous.ics"', "Cache-Control": "no-store" },
  });
}

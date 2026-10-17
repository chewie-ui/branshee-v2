/** Liens « Ajouter à mon agenda » (Google, Outlook) ; Apple et les autres passent par le fichier .ics. */
type Ev = { title: string; start: Date; end: Date; location?: string | null; details?: string | null };
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(e: Ev) {
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${stamp(e.start)}/${stamp(e.end)}` });
  if (e.location) p.set("location", e.location);
  if (e.details) p.set("details", e.details);
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function outlookCalendarUrl(e: Ev) {
  const p = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: e.title, startdt: e.start.toISOString(), enddt: e.end.toISOString() });
  if (e.location) p.set("location", e.location);
  if (e.details) p.set("body", e.details);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p}`;
}

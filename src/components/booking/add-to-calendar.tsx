import { CalendarPlus } from "lucide-react";
import { googleCalendarUrl, outlookCalendarUrl } from "@/lib/calendar-links";

/** Menu « Ajouter à mon agenda » : Google, Outlook, Apple / autres (.ics). Sans JavaScript (details/summary). */
export function AddToCalendar({ token, title, start, end, location, details }: { token: string; title: string; start: Date; end: Date; location?: string | null; details?: string | null }) {
  const ev = { title, start, end, location, details };
  const item = "block px-4 py-2.5 text-sm hover:bg-surface-muted";
  return (
    <details className="group relative">
      <summary className="flex h-10 w-full cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
        <CalendarPlus className="size-4" aria-hidden="true" />
        Ajouter à mon agenda
      </summary>
      <div className="absolute inset-x-0 z-10 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
        <a className={item} href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer">Google Agenda</a>
        <a className={item} href={`/r/${token}/calendrier.ics`}>Apple Calendrier</a>
        <a className={item} href={outlookCalendarUrl(ev)} target="_blank" rel="noopener noreferrer">Outlook</a>
        <a className={item} href={`/r/${token}/calendrier.ics`}>Autre (fichier .ics)</a>
      </div>
    </details>
  );
}

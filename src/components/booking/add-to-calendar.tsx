import { CalendarPlus } from "lucide-react";
import { googleCalendarUrl, outlookCalendarUrl } from "@/lib/calendar-links";

/** Menu « Ajouter à mon agenda » : Google, Outlook, Apple / autres (.ics). Sans JavaScript (details/summary). */
export function AddToCalendar({ token, title, start, end, location, details, labels = { add: "Ajouter à mon agenda", google: "Google Agenda", apple: "Apple Calendrier", other: "Autre (fichier .ics)" } }: { token: string; title: string; start: Date; end: Date; location?: string | null; details?: string | null; labels?: { add: string; google: string; apple: string; other: string } }) {
  const ev = { title, start, end, location, details };
  const item = "block px-4 py-2.5 text-sm hover:bg-surface-muted";
  return (
    <details className="group relative">
      <summary className="flex h-10 w-full cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
        <CalendarPlus className="size-4" aria-hidden="true" />
        {labels.add}
      </summary>
      <div className="absolute inset-x-0 z-10 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
        <a className={item} href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer">{labels.google}</a>
        <a className={item} href={`/r/${token}/calendrier.ics`}>{labels.apple}</a>
        <a className={item} href={outlookCalendarUrl(ev)} target="_blank" rel="noopener noreferrer">Outlook</a>
        <a className={item} href={`/r/${token}/calendrier.ics`}>{labels.other}</a>
      </div>
    </details>
  );
}

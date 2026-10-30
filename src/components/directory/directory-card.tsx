import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import type { DirectoryEntry } from "@/server/site";

/** Carte d'un pro dans l'annuaire : photo, métier, ville, note réelle, bouton de réservation. */
export function DirectoryCard({ b }: { b: DirectoryEntry }) {
  return (
    <Link href={`/${b.slug}`} className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition-colors duration-150 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <span className="flex items-center gap-3">
        {b.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.photoUrl} alt="" width={48} height={48} className="size-12 shrink-0 rounded-full object-cover" loading="lazy" />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-soft-foreground" aria-hidden="true">{b.name.slice(0, 2).toUpperCase()}</span>
        )}
        <span className="min-w-0">
          <span className="block truncate font-semibold">{b.name}</span>
          <span className="block truncate text-sm text-muted">{b.type ?? "Professionnel"}</span>
        </span>
      </span>
      <span className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
        <span className="inline-flex min-w-0 items-center gap-1 truncate"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{b.city ?? "Adresse sur la page"}</span>
        {b.rating ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-text"><Star className="size-3.5 fill-current text-warning" aria-hidden="true" />{String(b.rating).replace(".", ",")} <span className="text-muted">({b.reviews})</span></span>
        ) : null}
      </span>
      <span className="mt-auto pt-4">
        <span className="flex h-10 items-center justify-center rounded-lg bg-accent text-sm font-medium text-accent-foreground transition-colors duration-150 group-hover:bg-accent-hover">Prendre rendez-vous</span>
      </span>
    </Link>
  );
}

export function DirectoryGrid({ rows }: { rows: DirectoryEntry[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((b) => (
        <li key={b.id}>
          <DirectoryCard b={b} />
        </li>
      ))}
    </ul>
  );
}

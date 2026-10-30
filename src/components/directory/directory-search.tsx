import { MapPin, Search } from "lucide-react";

/**
 * Barre « Quoi / Où » de l'annuaire (formulaire GET, fonctionne sans JavaScript).
 * Les suggestions viennent des métiers et des villes connus (datalist native).
 */
export function DirectorySearch({ q = "", ou = "", metiers, villes, big = false }: { q?: string; ou?: string; metiers: string[]; villes: string[]; big?: boolean }) {
  const h = big ? "h-12 sm:h-14 text-base" : "h-11 text-sm";
  return (
    <form role="search" action="/annuaire" className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm sm:grid-cols-[1.2fr_1fr_auto]">
      <label className="relative">
        <span className="sr-only">Quoi : métier, prestation ou nom</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input name="q" defaultValue={q} list="dir-metiers" autoComplete="off" placeholder="Coiffeur, kiné, massage, nom…" className={`${h} w-full rounded-xl border border-border-strong bg-surface pr-3 pl-10 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30`} />
      </label>
      <label className="relative">
        <span className="sr-only">Où : ville ou code postal</span>
        <MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input name="ou" defaultValue={ou} list="dir-villes" autoComplete="off" placeholder="Ville ou code postal" className={`${h} w-full rounded-xl border border-border-strong bg-surface pr-3 pl-10 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30`} />
      </label>
      <button type="submit" className={`${h} inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 font-medium text-accent-foreground transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-px`}>
        <Search className="size-4" aria-hidden="true" />
        Rechercher
      </button>
      <datalist id="dir-metiers">{metiers.map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="dir-villes">{villes.map((v) => <option key={v} value={v} />)}</datalist>
    </form>
  );
}

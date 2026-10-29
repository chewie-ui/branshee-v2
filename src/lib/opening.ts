/**
 * Horaires d'ouverture servant de cadre aux plages des prestations (pur, testé).
 * Une prestation ne peut être proposée ni un jour de fermeture, ni avant l'ouverture, ni après la fermeture.
 */
export type Range = { start: string; end: string };
export type Week = Partial<Record<number, Range[]>>;

const DAY = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const hm = (t: string) => t.slice(0, 5);

/** Plages fusionnées et triées (les chevauchements n'en font plus qu'une). */
export function merge(ranges: Range[]): Range[] {
  const s = [...ranges].map((r) => ({ start: hm(r.start), end: hm(r.end) })).sort((a, b) => a.start.localeCompare(b.start));
  const out: Range[] = [];
  for (const r of s) {
    const last = out.at(-1);
    if (last && r.start <= last.end) last.end = r.end > last.end ? r.end : last.end;
    else out.push({ ...r });
  }
  return out;
}

/** Cadre par jour à partir de lignes d'horaires (plusieurs praticiens : leurs horaires réunis). */
export function boundsFrom(rows: { weekday: number; start: string; end: string }[]): Week | null {
  if (!rows.length) return null;
  const w: Week = {};
  for (let d = 0; d < 7; d++) w[d] = merge(rows.filter((r) => r.weekday === d).map((r) => ({ start: r.start, end: r.end })));
  return w;
}

/** Première plage hors des horaires d'ouverture, en clair ; null si tout est dans le cadre. */
export function outsideBounds(week: Week, bounds: Week | null): string | null {
  if (!bounds) return null;
  for (const [k, ranges] of Object.entries(week)) {
    const d = Number(k);
    if (!ranges?.length) continue;
    const open = bounds[d] ?? [];
    if (!open.length) return `Vous êtes fermé le ${DAY[d]} : la prestation ne peut pas y être proposée.`;
    for (const r of ranges) {
      const ok = open.some((o) => hm(r.start) >= o.start && hm(r.end) <= o.end);
      if (!ok) return `Le ${DAY[d]}, vous êtes ouvert ${open.map((o) => `de ${o.start} à ${o.end}`).join(" et ")} : choisissez des heures dans ces horaires.`;
    }
  }
  return null;
}

/** Résumé court des plages d'une prestation (« Jeu 14:00–17:00 · Ven 9:00–12:00 »). */
export function summarize(week: Week): string {
  const short = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => week[d]?.length)
    .map((d) => `${short[d]} ${week[d]!.map((r) => `${hm(r.start)}–${hm(r.end)}`).join(", ")}`)
    .join(" · ");
}

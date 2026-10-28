/** App Comptabilité : périodes et agrégats TVA (pur, testé). Montants en centimes. */
export type Period = { kind: "month" | "quarter" | "year"; year: number; index: number };

export function periodRange(p: Period): { from: string; to: string; label: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (p.kind === "year") return { from: `${p.year}-01-01`, to: `${p.year}-12-31`, label: String(p.year) };
  if (p.kind === "quarter") {
    const m1 = (p.index - 1) * 3 + 1;
    return { from: `${p.year}-${pad(m1)}-01`, to: `${p.year}-${pad(m1 + 2)}-${last(p.year, m1 + 2)}`, label: `T${p.index} ${p.year}` };
  }
  const label = new Intl.DateTimeFormat("fr-BE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(p.year, p.index - 1, 15)));
  return { from: `${p.year}-${pad(p.index)}-01`, to: `${p.year}-${pad(p.index)}-${last(p.year, p.index)}`, label };
}

export function parsePeriod(s: string | undefined, today: string): Period {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const q = s?.match(/^(\d{4})-T([1-4])$/);
  if (q) return { kind: "quarter", year: Number(q[1]), index: Number(q[2]) };
  const mo = s?.match(/^(\d{4})-(\d{2})$/);
  if (mo && Number(mo[2]) >= 1 && Number(mo[2]) <= 12) return { kind: "month", year: Number(mo[1]), index: Number(mo[2]) };
  const yr = s?.match(/^(\d{4})$/);
  if (yr) return { kind: "year", year: Number(yr[1]), index: 1 };
  return { kind: "quarter", year: y, index: Math.ceil(m / 3) };
}

export const periodKey = (p: Period) => (p.kind === "year" ? String(p.year) : p.kind === "quarter" ? `${p.year}-T${p.index}` : `${p.year}-${String(p.index).padStart(2, "0")}`);

export type RateRow = { rate: number; base: number; vat: number };

/** Additionne des lignes { taux, base, TVA } par taux (les notes de crédit arrivent en négatif). */
export function sumByRate(rows: RateRow[]): RateRow[] {
  const m = new Map<number, RateRow>();
  for (const r of rows) {
    const cur = m.get(r.rate) ?? { rate: r.rate, base: 0, vat: 0 };
    m.set(r.rate, { rate: r.rate, base: cur.base + r.base, vat: cur.vat + r.vat });
  }
  return [...m.values()].sort((a, b) => b.rate - a.rate);
}

/** Grilles belges de ventes par taux : 0 % → 00, 6 % → 01, 12 % → 02, 21 % → 03. */
export const GRID: Record<number, string> = { 0: "00", 6: "01", 12: "02", 21: "03" };

/** Solde de TVA : positif = à payer (grille 71), négatif = à récupérer (grille 72). */
export const vatBalance = (due: number, deductible: number) => due - deductible;

/** Seuil de la franchise de TVA en Belgique (chiffre d'affaires annuel HTVA). */
export const FRANCHISE_THRESHOLD = 2_500_000;

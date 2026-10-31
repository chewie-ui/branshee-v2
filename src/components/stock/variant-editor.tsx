"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { COMMON_COLORS, SIZE_GRIDS, combinations, gridById, sortSizes, variantLabel } from "@/lib/sizes";

export type VariantRow = { id?: string; size: string | null; color: string | null; barcode: string; qty: string; stock?: number };
type Existing = { id: string; size: string | null; color: string | null; barcode: string | null; stockQty: number };

const key = (s: string | null, c: string | null) => `${(s ?? "").toLowerCase()}|${(c ?? "").toLowerCase()}`;

/**
 * Choix des tailles (grilles avec équivalences EU / UK / US) et des couleurs, puis une ligne par
 * combinaison : quantité de départ et code-barres. Les déclinaisons existantes gardent leur stock.
 */
export function VariantEditor({ initialGrid, existing, track, onChange }: { initialGrid: string | null; existing: Existing[]; track: boolean; onChange: (grid: string, rows: VariantRow[]) => void }) {
  const [grid, setGrid] = useState(initialGrid ?? (existing.length ? "custom" : "letters"));
  const [sizes, setSizes] = useState<string[]>(() => [...new Set(existing.map((e) => e.size).filter((x): x is string => !!x))]);
  const [colors, setColors] = useState<string[]>(() => [...new Set(existing.map((e) => e.color).filter((x): x is string => !!x))]);
  const [extra, setExtra] = useState<Record<string, { barcode: string; qty: string }>>(() => Object.fromEntries(existing.map((e) => [key(e.size, e.color), { barcode: e.barcode ?? "", qty: "" }])));
  const [customSize, setCustomSize] = useState("");
  const [customColor, setCustomColor] = useState("");
  const g = gridById(grid);

  const rowsFor = (s: string[], c: string[], ex: typeof extra): VariantRow[] =>
    combinations(sortSizes(grid, s), c).map((v) => {
      const old = existing.find((e) => key(e.size, e.color) === key(v.size, v.color));
      const x = ex[key(v.size, v.color)] ?? { barcode: "", qty: "" };
      return { id: old?.id, size: v.size, color: v.color, barcode: x.barcode, qty: x.qty, stock: old?.stockQty };
    });
  const emit = (s = sizes, c = colors, ex = extra, gr = grid) => onChange(gr, rowsFor(s, c, ex));

  const toggleSize = (v: string) => { const next = sizes.includes(v) ? sizes.filter((x) => x !== v) : [...sizes, v]; setSizes(next); emit(next); };
  const toggleColor = (v: string) => { const next = colors.includes(v) ? colors.filter((x) => x !== v) : [...colors, v]; setColors(next); emit(sizes, next); };
  const addCustom = (kind: "size" | "color") => {
    const raw = kind === "size" ? customSize : customColor;
    const vals = raw.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 40);
    if (!vals.length) return;
    if (kind === "size") { const next = [...new Set([...sizes, ...vals.map((v) => v.slice(0, 30))])]; setSizes(next); setCustomSize(""); emit(next); }
    else { const next = [...new Set([...colors, ...vals.map((v) => v.slice(0, 40))])]; setColors(next); setCustomColor(""); emit(sizes, next); }
  };
  const setCell = (r: VariantRow, patch: Partial<{ barcode: string; qty: string }>) => {
    const k = key(r.size, r.color);
    const next = { ...extra, [k]: { ...(extra[k] ?? { barcode: "", qty: "" }), ...patch } };
    setExtra(next);
    emit(sizes, colors, next);
  };
  const rows = rowsFor(sizes, colors, extra);
  const chip = (on: boolean) => cn("inline-flex min-h-9 flex-col items-center justify-center rounded-lg border px-2.5 py-1 text-sm transition-colors duration-150", on ? "border-accent bg-accent-soft font-medium text-accent-soft-foreground" : "border-border text-text hover:border-border-strong");

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="vr-grid" className="text-sm font-medium">Type de tailles</label>
        <Select id="vr-grid" value={grid} onChange={(e) => { setGrid(e.target.value); emit(sizes, colors, extra, e.target.value); }} className="mt-1">
          {SIZE_GRIDS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </Select>
        {g ? <p className="mt-1 text-xs text-muted">{g.help}</p> : null}
      </div>

      {g && g.sizes.length ? (
        <div>
          <p className="mb-2 text-sm font-medium">Tailles disponibles <span className="font-normal text-muted">(cliquez pour choisir)</span></p>
          <div className="flex flex-wrap gap-1.5">
            {g.sizes.map((s) => (
              <button key={s.value} type="button" aria-pressed={sizes.includes(s.value)} onClick={() => toggleSize(s.value)} className={chip(sizes.includes(s.value))} title={s.hint}>
                <span>{s.value}</span>
                {s.hint ? <span className="text-[10px] leading-tight opacity-75">{s.hint}</span> : null}
              </button>
            ))}
          </div>
          {g.sizes.length > 3 ? (
            <div className="mt-2 flex gap-3 text-xs">
              <button type="button" className="font-medium text-accent hover:text-accent-hover" onClick={() => { const all = [...new Set([...sizes, ...g.sizes.map((s) => s.value)])]; setSizes(all); emit(all); }}>Tout choisir</button>
              {sizes.length ? <button type="button" className="font-medium text-muted hover:text-text" onClick={() => { setSizes([]); emit([]); }}>Tout enlever</button> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Input aria-label="Ajouter des tailles" value={customSize} onChange={(e) => setCustomSize(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom("size"); } }} placeholder={grid === "custom" ? "Ex. : 50 ml, 100 ml, 200 ml" : "Autre taille (ex. : 5XL)"} />
        <button type="button" onClick={() => addCustom("size")} className="inline-flex h-11 shrink-0 items-center gap-1 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted"><Plus className="size-4" aria-hidden="true" />Ajouter</button>
      </div>
      {sizes.filter((s) => !g?.sizes.some((x) => x.value === s)).length ? (
        <div className="flex flex-wrap gap-1.5">
          {sizes.filter((s) => !g?.sizes.some((x) => x.value === s)).map((s) => (
            <span key={s} className="inline-flex h-8 items-center gap-1 rounded-lg border border-accent bg-accent-soft pr-1 pl-2.5 text-sm font-medium text-accent-soft-foreground">{s}<button type="button" onClick={() => toggleSize(s)} className="flex size-6 items-center justify-center rounded" aria-label={`Retirer la taille ${s}`}><X className="size-3.5" aria-hidden="true" /></button></span>
          ))}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium">Couleurs <span className="font-normal text-muted">(facultatif)</span></p>
        <div className="flex flex-wrap gap-1.5">
          {[...new Set([...COMMON_COLORS, ...colors])].map((c) => (
            <button key={c} type="button" aria-pressed={colors.includes(c)} onClick={() => toggleColor(c)} className={chip(colors.includes(c))}>{c}</button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input aria-label="Ajouter des couleurs" value={customColor} onChange={(e) => setCustomColor(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom("color"); } }} placeholder="Autre couleur ou modèle (ex. : Bordeaux, Kaki)" />
          <button type="button" onClick={() => addCustom("color")} className="inline-flex h-11 shrink-0 items-center gap-1 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted"><Plus className="size-4" aria-hidden="true" />Ajouter</button>
        </div>
      </div>

      {rows.length ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <p className="border-b border-border bg-surface-muted px-3 py-2 text-sm font-medium">{rows.length} déclinaison{rows.length > 1 ? "s" : ""}</p>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
                <tr><th scope="col" className="px-3 py-2 font-medium">Taille / couleur</th>{track ? <th scope="col" className="w-24 px-2 py-2 font-medium">Stock</th> : null}<th scope="col" className="px-2 py-2 font-medium">Code-barres</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={key(r.size, r.color)}>
                    <td className="px-3 py-1.5 font-medium">{variantLabel(r)}</td>
                    {track ? (
                      <td className="px-2 py-1.5">
                        {r.id ? <span className="tabular-nums text-muted" title="Pour changer la quantité, utilisez Réception ou Inventaire">{r.stock ?? 0}</span> : <Input aria-label={`Stock de départ ${variantLabel(r)}`} inputMode="numeric" value={r.qty} onChange={(e) => setCell(r, { qty: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="0" className="h-9 w-20" />}
                      </td>
                    ) : null}
                    <td className="px-2 py-1.5"><Input aria-label={`Code-barres ${variantLabel(r)}`} inputMode="numeric" value={r.barcode} onChange={(e) => setCell(r, { barcode: e.target.value.trim().slice(0, 40) })} className="h-9" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-muted">Choisissez au moins une taille ou une couleur.</p>}
      {existing.some((e) => !rows.some((r) => r.id === e.id)) ? <p className="text-xs text-warning">Les déclinaisons décochées seront retirées (archivées si elles ont déjà été vendues).</p> : null}
    </div>
  );
}

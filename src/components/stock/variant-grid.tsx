"use client";

import { useState, useTransition } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { isLow } from "@/lib/stock";
import { sizeHint, sortSizes } from "@/lib/sizes";
import { countVariants } from "@/server/actions/stock";
import type { ProductView } from "@/server/stock";

type Res = { ok: boolean; message?: string; error?: string };

/**
 * Stock d'un modèle en tableau : une ligne par taille, une colonne par couleur. Un clic sur une case ouvre
 * réception/sortie/inventaire de cette déclinaison ; « Inventaire » permet de tout recompter d'un coup.
 */
export function VariantGrid({ model, variants, onPick, onDone }: { model: ProductView; variants: ProductView[]; onPick: (v: ProductView) => void; onDone: (text: string, ok: boolean) => void }) {
  const sizes = sortSizes(model.sizeGrid, [...new Set(variants.map((v) => v.size ?? ""))]);
  const colors = [...new Set(variants.map((v) => v.color ?? ""))].sort((a, b) => a.localeCompare(b, "fr"));
  const at = (s: string, c: string) => variants.find((v) => (v.size ?? "") === s && (v.color ?? "") === c);
  const [counting, setCounting] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const track = variants.some((v) => v.trackStock);
  const save = () =>
    start(async () => {
      const list = variants.filter((v) => v.trackStock && counts[v.id] !== undefined && counts[v.id] !== "").map((v) => ({ id: v.id, qty: Number(counts[v.id]) }));
      if (!list.length) return setCounting(false);
      const r: Res = await countVariants(model.id, list).catch(() => ({ ok: false, error: "Envoi impossible. Vérifiez votre connexion." }));
      onDone(r.ok ? (r.message ?? "Inventaire enregistré.") : (r.error ?? "Inventaire impossible."), r.ok);
      if (r.ok) { setCounting(false); setCounts({}); }
    });

  return (
    <div className="border-t border-border bg-surface-muted/40 px-4 py-3 sm:px-5">
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="py-1.5 pr-4 font-medium">Taille</th>
              {colors.map((c) => <th key={c || "-"} scope="col" className="px-1.5 py-1.5 text-center font-medium">{c || "Stock"}</th>)}
            </tr>
          </thead>
          <tbody>
            {sizes.map((s) => (
              <tr key={s || "-"}>
                <th scope="row" className="py-1 pr-4 text-left font-medium whitespace-nowrap">
                  {s || "—"}
                  {sizeHint(model.sizeGrid, s) ? <span className="block text-[11px] font-normal text-muted">{sizeHint(model.sizeGrid, s)}</span> : null}
                </th>
                {colors.map((c) => {
                  const v = at(s, c);
                  if (!v) return <td key={c || "-"} className="px-1.5 py-1 text-center text-muted">·</td>;
                  const low = isLow(v);
                  return (
                    <td key={c || "-"} className="px-1.5 py-1 text-center">
                      {counting && v.trackStock ? (
                        <input aria-label={`Quantité comptée ${s} ${c}`.trim()} inputMode="numeric" value={counts[v.id] ?? String(v.stockQty)} onChange={(e) => setCounts((x) => ({ ...x, [v.id]: e.target.value.replace(/\D/g, "").slice(0, 6) }))} className="h-9 w-16 rounded-md border border-border-strong bg-surface text-center tabular-nums" />
                      ) : (
                        <button type="button" onClick={() => onPick(v)} title={v.barcode ? `Code-barres ${v.barcode}` : undefined} className={cn("h-9 min-w-12 rounded-md border px-2 font-semibold tabular-nums transition-colors hover:border-accent", v.trackStock && v.stockQty <= 0 ? "border-danger/40 bg-danger-soft text-danger" : low ? "border-warning/40 bg-warning-soft text-warning" : "border-border bg-surface")} aria-label={`${[s, c].filter(Boolean).join(" ")} : ${v.trackStock ? `${v.stockQty} en stock` : "stock non suivi"}. Réception, sortie ou inventaire`}>
                          {v.trackStock ? v.stockQty : "—"}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {track ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {counting ? (
            <>
              <Button size="sm" loading={pending} onClick={save}>Enregistrer l&apos;inventaire</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setCounting(false); setCounts({}); }}>Annuler</Button>
              <span className="text-xs text-muted">Tapez la quantité comptée pour chaque case.</span>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" icon={<ClipboardCheck className="size-4" aria-hidden="true" />} onClick={() => setCounting(true)}>Inventaire de toutes les tailles</Button>
              <span className="text-xs text-muted">Cliquez sur une case pour une réception, une sortie ou un inventaire.</span>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

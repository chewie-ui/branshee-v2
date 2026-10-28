"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer, Undo2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { PAY_METHODS } from "@/lib/stock";
import { refundSale } from "@/server/actions/pos";

type Row = { id: string; number: string; total: number; method: string; status: string; createdAt: string; items: number };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

export function SalesList({ rows, canRefund, tz }: { rows: Row[]; canRefund: boolean; tz: string }) {
  const router = useRouter();
  const [refund, setRefund] = useState<Row | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fmt = new Intl.DateTimeFormat("fr-BE", { timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  if (!rows.length) return <Card className="p-8 text-center text-sm text-muted">Aucun ticket sur les 30 derniers jours.</Card>;
  return (
    <div className="space-y-3">
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
              <span className="w-28 shrink-0 text-muted">{fmt.format(new Date(r.createdAt))}</span>
              <span className="min-w-0 flex-1"><span className="font-medium tabular-nums">{r.number}</span><span className="text-muted"> · {r.items} article{r.items > 1 ? "s" : ""} · {PAY_METHODS[r.method as keyof typeof PAY_METHODS] ?? r.method}</span></span>
              {r.status === "refunded" ? <span className="rounded bg-danger-soft px-1.5 text-xs font-medium text-danger">Remboursé</span> : null}
              <span className={cn("w-20 text-right font-medium tabular-nums", r.status === "refunded" && "text-muted line-through")}>{eur(r.total)}</span>
              <a href={`/imprimer/ticket/${r.id}`} target="_blank" rel="noopener" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label={`Imprimer le ticket ${r.number}`}><Printer className="size-4" aria-hidden="true" /></a>
              {canRefund && r.status === "paid" ? <button type="button" onClick={() => setRefund(r)} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label={`Rembourser le ticket ${r.number}`}><Undo2 className="size-4" aria-hidden="true" /></button> : <span className="size-9" />}
            </li>
          ))}
        </ul>
      </Card>
      <ConfirmDialog open={!!refund} title={`Rembourser le ticket ${refund?.number ?? ""} ?`} confirmLabel="Rembourser" danger loading={pending} onCancel={() => setRefund(null)} onConfirm={() => refund && start(async () => { const r: { ok: boolean; message?: string; error?: string } = await refundSale(refund.id).catch(() => ({ ok: false, error: "Remboursement impossible." })); setRefund(null); setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Remboursé.") : (r.error ?? "Impossible.") }); router.refresh(); })}>
        {refund ? `${eur(refund.total)} à rendre au client. Les produits reviennent en stock.` : null}
      </ConfirmDialog>
    </div>
  );
}

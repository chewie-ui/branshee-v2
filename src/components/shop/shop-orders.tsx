"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Banknote, Mail, MapPin, Phone, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { SHOP_STATUS, type ShopStatus } from "@/lib/shop";
import { cancelShopOrder, markShopOrderPaid, setShopOrderStatus } from "@/server/actions/shop";

type Order = { id: string; number: number; status: string; payMethod: string; paid: boolean; fulfilment: string; name: string; email: string; phone: string | null; address: string | null; note: string | null; lines: { name: string; qty: number; unitCents: number }[]; total: number; delivery: number; createdAt: string };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);
const PAY = { online: "Payé en ligne", pickup: "Paiement au retrait", transfer: "Virement" } as const;
const CLS: Record<string, string> = { pending_payment: "bg-surface-muted text-muted", new: "bg-accent-soft text-accent", ready: "bg-warning-soft text-warning", shipped: "bg-warning-soft text-warning", done: "bg-success-soft text-success", cancelled: "bg-danger-soft text-danger" };

export function ShopOrders({ orders, canManage, tz }: { orders: Order[]; canManage: boolean; tz: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cancel, setCancel] = useState<Order | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => start(async () => { const r: { ok: boolean; message?: string; error?: string } = await fn().catch(() => ({ ok: false, error: "Action impossible." })); setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Fait.") : (r.error ?? "Action impossible.") }); router.refresh(); });
  const list = orders.filter((o) => filter === "all" || ["new", "ready", "shipped"].includes(o.status));
  const fmt = new Intl.DateTimeFormat("fr-BE", { timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-surface-muted p-1" role="group" aria-label="Commandes affichées">
        {([["open", "À traiter"], ["all", "Toutes"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn("h-8 rounded-md px-3 text-sm font-medium", filter === k ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>{l}</button>)}
      </div>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      {list.length === 0 ? <Card className="p-8 text-center"><ShoppingBag className="mx-auto size-10 text-muted" aria-hidden="true" /><p className="mt-3 font-medium">{filter === "open" ? "Aucune commande à traiter" : "Aucune commande"}</p></Card> : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {list.map((o) => {
            const st = SHOP_STATUS[o.status as ShopStatus];
            const next = o.status === "new" ? (o.fulfilment === "delivery" ? "shipped" : "ready") : st?.next;
            return (
              <li key={o.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">n° {o.number} · {o.name}</p>
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", CLS[o.status])}>{st?.label ?? o.status}</span>
                    <span className="ml-auto text-sm text-muted">{fmt.format(new Date(o.createdAt))}</span>
                  </div>
                  <ul className="mt-2 text-sm">{o.lines.map((l, i) => <li key={i}><b className="tabular-nums">{l.qty}×</b> {l.name}</li>)}</ul>
                  {o.note ? <p className="mt-2 rounded bg-warning-soft px-2 py-1 text-sm text-warning">{o.note}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span>{o.fulfilment === "delivery" ? "Livraison" : "Retrait"}</span>
                    {o.address ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{o.address}</span> : null}
                    <a href={`mailto:${o.email}`} className="inline-flex items-center gap-1 hover:text-text"><Mail className="size-3.5" aria-hidden="true" />{o.email}</a>
                    {o.phone ? <a href={`tel:${o.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-text"><Phone className="size-3.5" aria-hidden="true" />{o.phone}</a> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="font-semibold tabular-nums">{eur(o.total)}</span>
                    <span className={cn("text-xs", o.paid ? "text-success" : "text-muted")}>{o.paid ? (o.payMethod === "online" ? "Payé en ligne" : "Encaissé") : PAY[o.payMethod as keyof typeof PAY]}</span>
                    <div className="ml-auto flex flex-wrap gap-2">
                      {next && o.status !== "cancelled" ? <Button size="sm" disabled={pending} icon={<ArrowRight className="size-4" aria-hidden="true" />} onClick={() => run(() => setShopOrderStatus(o.id, next))}>{SHOP_STATUS[next as ShopStatus].label}</Button> : null}
                      {!o.paid && o.status !== "cancelled" && o.status !== "pending_payment" ? <Button size="sm" variant="secondary" disabled={pending} icon={<Banknote className="size-4" aria-hidden="true" />} onClick={() => run(() => markShopOrderPaid(o.id))}>Encaissée</Button> : null}
                      {canManage && !["done", "cancelled"].includes(o.status) ? <Button size="sm" variant="ghost" className="text-danger" icon={<X className="size-4" aria-hidden="true" />} onClick={() => setCancel(o)}>Annuler</Button> : null}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog open={!!cancel} title={`Annuler la commande n° ${cancel?.number ?? ""} ?`} confirmLabel="Annuler la commande" danger loading={pending} onCancel={() => setCancel(null)} onConfirm={() => cancel && (setCancel(null), run(() => cancelShopOrder(cancel.id)))}>
        Les produits reviennent en stock. Prévenez le client{cancel?.paid ? " et remboursez-le" : ""}.
      </ConfirmDialog>
    </div>
  );
}

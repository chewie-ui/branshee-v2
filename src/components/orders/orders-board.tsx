"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Banknote, Bell, BellOff, QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { ORDER_STATUS, eur, isOrderStatus } from "@/lib/orders";
import { setOrderPaid, setOrderStatus } from "@/server/actions/orders";

export type OrderView = { id: string; number: number; status: string; table: string; lines: { name: string; qty: number; note?: string; priceCents: number }[]; totalCents: number; customerName: string | null; note: string | null; paid: boolean; createdAt: string };

const COLUMNS = [
  { id: "new", title: "Nouvelles" },
  { id: "preparing", title: "En préparation" },
  { id: "ready", title: "Prêtes" },
  { id: "served", title: "Servies" },
] as const;

/** Bip court à chaque nouvelle commande (si le navigateur l'autorise). */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctx();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.4);
  } catch {}
}

/** Tableau de la cuisine : colonnes par statut, actualisation automatique, encaissement. */
export function OrdersBoard({ orders, hasTables, canEdit, tz }: { orders: OrderView[]; hasTables: boolean; canEdit: boolean; tz: string }) {
  const router = useRouter();
  const [sound, setSound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 8000);
    return () => clearInterval(t);
  }, [router]);
  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id));
    if (seen.current && sound && orders.some((o) => o.status === "new" && !seen.current!.has(o.id))) beep();
    seen.current = ids;
  }, [orders, sound]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn().catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion." }));
      if (!r.ok) setError(r.error ?? "Action impossible.");
      router.refresh();
    });
  const time = (iso: string) => new Intl.DateTimeFormat("fr-BE", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const unpaid = orders.filter((o) => o.status !== "cancelled" && !o.paid).reduce((a, o) => a + o.totalCents, 0);
  const cancelled = orders.filter((o) => o.status === "cancelled");

  if (!hasTables)
    return (
      <Card className="p-8 text-center">
        <QrCode className="mx-auto size-10 text-muted" aria-hidden="true" />
        <p className="mt-3 font-medium">Commencez par votre carte et vos tables</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">Ajoutez vos plats, créez vos tables puis imprimez les QR codes. Vos clients les scannent et commandent depuis leur téléphone : les commandes arrivent ici.</p>
        {canEdit ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/app/commandes/carte" className="inline-flex h-10 items-center rounded-lg border border-border-strong px-4 text-sm font-medium hover:bg-surface-muted">1. La carte</Link>
            <Link href="/app/commandes/tables" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover">2. Les tables et QR codes</Link>
          </div>
        ) : <p className="mt-3 text-sm text-muted">Demandez au responsable de préparer la carte et les tables.</p>}
      </Card>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted">Dernières 24 h · à encaisser : <span className="font-semibold text-text tabular-nums">{eur(unpaid)}</span></p>
        <Button variant="secondary" size="sm" className="ml-auto" aria-pressed={sound} icon={sound ? <Bell className="size-4" aria-hidden="true" /> : <BellOff className="size-4" aria-hidden="true" />} onClick={() => { setSound((s) => !s); if (!sound) beep(); }}>
          {sound ? "Son activé" : "Activer le son"}
        </Button>
      </div>
      {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.id);
          if (col.id !== "served") list.reverse(); // les plus anciennes d'abord : elles attendent depuis le plus longtemps
          return (
            <section key={col.id} aria-labelledby={`col-${col.id}`} className="min-w-0 rounded-xl bg-surface-muted/60 p-3">
              <h2 id={`col-${col.id}`} className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">{col.title}<span className="rounded-full bg-surface px-2 text-xs tabular-nums">{list.length}</span></h2>
              <ul className="space-y-3">
                {list.length === 0 ? <li className="px-1 py-6 text-center text-sm text-muted">Rien pour l&apos;instant</li> : null}
                {list.map((o) => {
                  const next = isOrderStatus(o.status) ? ORDER_STATUS[o.status].next : null;
                  return (
                    <li key={o.id}>
                      <Card className={cn("p-4", o.status === "new" && "border-accent")}>
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-lg font-semibold">n° {o.number}</p>
                          <p className="text-sm text-muted">{time(o.createdAt)}</p>
                        </div>
                        <p className="text-sm font-medium">{o.table}{o.customerName ? ` · ${o.customerName}` : ""}</p>
                        <ul className="mt-2 space-y-1 text-sm">
                          {o.lines.map((l, i) => (
                            <li key={i}><span className="font-semibold tabular-nums">{l.qty}×</span> {l.name}{l.note ? <span className="block pl-6 text-muted">{l.note}</span> : null}</li>
                          ))}
                        </ul>
                        {o.note ? <p className="mt-2 rounded-md bg-warning-soft px-2 py-1 text-sm text-warning">{o.note}</p> : null}
                        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                          <span className="font-semibold tabular-nums">{eur(o.totalCents)}</span>
                          {o.paid ? <span className="rounded bg-success-soft px-1.5 text-xs font-semibold text-success">Payée</span> : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {next ? <Button size="sm" disabled={pending} icon={<ArrowRight className="size-4" aria-hidden="true" />} onClick={() => act(() => setOrderStatus(o.id, next))}>{ORDER_STATUS[next].label}</Button> : null}
                          <Button size="sm" variant="secondary" disabled={pending} icon={<Banknote className="size-4" aria-hidden="true" />} onClick={() => act(() => setOrderPaid(o.id, !o.paid))}>{o.paid ? "Pas payée" : "Encaissée"}</Button>
                          {o.status === "new" ? <Button size="sm" variant="ghost" className="text-danger" disabled={pending} icon={<X className="size-4" aria-hidden="true" />} onClick={() => act(() => setOrderStatus(o.id, "cancelled"))}>Annuler</Button> : null}
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      {cancelled.length ? <p className="text-sm text-muted">{cancelled.length} commande{cancelled.length > 1 ? "s" : ""} annulée{cancelled.length > 1 ? "s" : ""} : {cancelled.map((o) => `n° ${o.number}`).join(", ")}.</p> : null}
    </div>
  );
}

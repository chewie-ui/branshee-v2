"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { cancelGiftCard, createGiftCard, redeemGiftCard } from "@/server/actions/loyalty";

type Row = { id: string; code: string; initial: number; balance: number; buyer: string | null; recipient: string | null; expiresOn: string; cancelled: boolean; createdAt: string };
type Res = { ok: boolean; message?: string; error?: string; id?: string };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);
const fday = (d: string) => d.split("-").reverse().join("/");

export function GiftCardsBoard({ rows, today, canManage }: { rows: Row[]; today: string; canManage: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ amount: "", buyerName: "", recipientName: "", message: "", months: "12" });
  const [use, setUse] = useState({ code: "", amount: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string; print?: string } | null>(null);
  const [cancel, setCancel] = useState<Row | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>, after?: (r: Res) => void) => start(async () => { const r: Res = await fn().catch(() => ({ ok: false, error: "Action impossible." })); setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Fait.") : (r.error ?? "Action impossible."), print: r.ok && r.id ? r.id : undefined }); if (r.ok) after?.(r); router.refresh(); });
  const active = rows.filter((g) => !g.cancelled && g.balance > 0 && g.expiresOn >= today);
  const outstanding = active.reduce((a, g) => a + g.balance, 0);
  return (
    <div className="space-y-4">
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}{msg.print ? <> <a href={`/imprimer/carte-cadeau/${msg.print}`} target="_blank" rel="noopener" className="font-medium underline">Imprimer la carte</a></> : null}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Vendre une carte" />
          <form className="grid gap-3 px-5 pb-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => createGiftCard({ ...f, months: Number(f.months) }), () => setF({ amount: "", buyerName: "", recipientName: "", message: "", months: f.months })); }}>
            <Field label="Montant (€)" htmlFor="gc-amount"><Input id="gc-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="50" /></Field>
            <Field label="Valable" htmlFor="gc-months"><Select id="gc-months" value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })}><option value="12">1 an</option><option value="18">18 mois</option><option value="24">2 ans</option></Select></Field>
            <Field label="Offerte par (facultatif)" htmlFor="gc-buyer"><Input id="gc-buyer" value={f.buyerName} onChange={(e) => setF({ ...f, buyerName: e.target.value })} maxLength={120} /></Field>
            <Field label="Pour (facultatif)" htmlFor="gc-to"><Input id="gc-to" value={f.recipientName} onChange={(e) => setF({ ...f, recipientName: e.target.value })} maxLength={120} /></Field>
            <Field label="Petit mot (facultatif)" htmlFor="gc-msg" className="sm:col-span-2"><Input id="gc-msg" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} maxLength={300} /></Field>
            <Button type="submit" loading={pending} icon={<Plus className="size-4" aria-hidden="true" />} className="sm:col-span-2 sm:justify-self-start">Créer la carte</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Utiliser une carte" description={`${active.length} carte${active.length > 1 ? "s" : ""} en cours · ${eur(outstanding)} à honorer`} />
          <form className="grid gap-3 px-5 pb-5 sm:grid-cols-[1fr_120px_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); run(() => redeemGiftCard(use), () => setUse({ code: "", amount: "" })); }}>
            <Field label="Code" htmlFor="gc-code"><Input id="gc-code" value={use.code} onChange={(e) => setUse({ ...use, code: e.target.value })} placeholder="ABCD-EFGH" maxLength={12} autoCapitalize="characters" /></Field>
            <Field label="Montant (€)" htmlFor="gc-use"><Input id="gc-use" inputMode="decimal" value={use.amount} onChange={(e) => setUse({ ...use, amount: e.target.value })} /></Field>
            <Button type="submit" loading={pending}>Déduire</Button>
          </form>
        </Card>
      </div>
      <Card className="overflow-hidden">
        {rows.length === 0 ? <div className="p-8 text-center"><Gift className="mx-auto size-10 text-muted" aria-hidden="true" /><p className="mt-3 font-medium">Aucune carte cadeau</p><p className="mt-1 text-sm text-muted">Créez-en une : un code unique, imprimable, utilisable en plusieurs fois.</p></div> : (
          <ul className="divide-y divide-border">
            {rows.map((g) => {
              const state = g.cancelled ? ["Annulée", "bg-danger-soft text-danger"] : g.balance === 0 ? ["Utilisée", "bg-surface-muted text-muted"] : g.expiresOn < today ? ["Expirée", "bg-surface-muted text-muted"] : ["Active", "bg-success-soft text-success"];
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                  <span className="w-24 font-mono font-semibold">{g.code}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{[g.recipient && `pour ${g.recipient}`, g.buyer && `de ${g.buyer}`, `jusqu'au ${fday(g.expiresOn)}`].filter(Boolean).join(" · ")}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", state[1])}>{state[0]}</span>
                  <span className="w-32 text-right tabular-nums"><b>{eur(g.balance)}</b> <span className="text-muted">/ {eur(g.initial)}</span></span>
                  <a href={`/imprimer/carte-cadeau/${g.id}`} target="_blank" rel="noopener" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label={`Imprimer la carte ${g.code}`}><Printer className="size-4" aria-hidden="true" /></a>
                  {canManage && !g.cancelled && g.balance > 0 ? <button type="button" onClick={() => setCancel(g)} className="text-xs text-muted hover:text-danger">Annuler</button> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <ConfirmDialog open={!!cancel} title={`Annuler la carte ${cancel?.code ?? ""} ?`} confirmLabel="Annuler la carte" danger loading={pending} onCancel={() => setCancel(null)} onConfirm={() => cancel && run(() => cancelGiftCard(cancel.id), () => setCancel(null))}>
        Elle ne pourra plus être utilisée (par exemple si elle a été remboursée).
      </ConfirmDialog>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { saveAutoRecharge, saveSmsSettings, topUpSms } from "@/server/actions/sms";

type Flags = { smsReminders: boolean; smsConfirmations: boolean; smsAllowOverage: boolean; whatsappReminders: boolean; whatsappConfirmations: boolean };
type R = { ok: true; message?: string; url?: string } | { ok: false; error: string };

function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start justify-between gap-4 px-5 py-4", disabled && "opacity-50")}>
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {description ? <span className="block text-muted">{description}</span> : null}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--accent)]" />
    </label>
  );
}

const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;

export function SmsPanel({ initial, included, used, balanceCents, autoRecharge, smsReady, waReady, isOwner, prices }: { initial: Flags; included: number; used: number; balanceCents: number; autoRecharge: { enabled: boolean; thresholdCents: number; amountCents: number }; smsReady: boolean; waReady: boolean; isOwner: boolean; prices: { sms: number; wa: number } }) {
  const [f, setF] = useState(initial);
  const [ar, setAr] = useState(autoRecharge);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<R>) => start(async () => { const r = await fn(); if (r.ok && r.url) { window.location.href = r.url; return; } setMsg(r.ok ? { ok: true, text: r.message ?? "Fait." } : { ok: false, text: r.error }); });
  const set = (k: keyof Flags) => (v: boolean) => { const next = { ...f, [k]: v }; setF(next); run(() => saveSmsSettings(next)); };

  return (
    <div className="space-y-6">
      {msg ? <p className={cn("rounded-lg p-3 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role="status">{msg.text}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-muted">Ce mois-ci</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{Math.min(used, included)} / {included}</p>
          <p className="text-sm text-muted">messages inclus dans votre forfait</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full bg-accent" style={{ width: `${included ? Math.min(100, (used / included) * 100) : 0}%` }} /></div>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Solde prépayé</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{eur(balanceCents)}</p>
          <p className="text-sm text-muted">SMS {eur(prices.sms)} · WhatsApp {eur(prices.wa)} au-delà du forfait</p>
          {isOwner ? <p className="text-xs text-muted">Montants TVA comprise.</p> : null}
          {isOwner ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {[10, 20, 50].map((a) => <Button key={a} size="sm" variant="secondary" loading={pending} onClick={() => run(() => topUpSms(a))}>+ {a} €</Button>)}
            </div>
          ) : null}
        </Card>
      </div>

      <Card>
        <CardHeader title="SMS" description={smsReady ? "Envoyés au numéro du client ; si l'envoi est impossible, l'email part à la place." : "Les SMS ne sont pas encore activés sur ce serveur."} />
        <div className="divide-y divide-border">
          <Switch checked={f.smsReminders} onChange={set("smsReminders")} label="Rappel par SMS" description="Remplace l'email de rappel, au même moment." />
          <Switch checked={f.smsConfirmations} onChange={set("smsConfirmations")} label="SMS de confirmation" description="En plus de l'email de confirmation." />
          <Switch checked={f.smsAllowOverage} onChange={set("smsAllowOverage")} label="Continuer au-delà du forfait" description="Les messages suivants sont pris sur le solde prépayé. Sinon : repli sur l'email." />
        </div>
        <div className="border-t border-border bg-surface-muted px-5 py-4 text-sm">
          <p className="mb-1 flex items-center gap-2 font-medium"><Smartphone className="size-4" aria-hidden="true" />Aperçu</p>
          <p className="text-muted">Rappel : votre rendez-vous chez <span className="text-text">votre établissement</span> est jeudi 12 mars à 10:30. Gérer : branshee.com/r/…</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="WhatsApp" description={waReady ? "Prioritaire et moins cher que le SMS ; repli SMS puis email." : "WhatsApp n'est pas encore configuré sur ce serveur (API Meta)."} />
        <div className="divide-y divide-border">
          <Switch checked={f.whatsappReminders} onChange={set("whatsappReminders")} label="Rappel par WhatsApp" disabled={!waReady && !f.whatsappReminders} />
          <Switch checked={f.whatsappConfirmations} onChange={set("whatsappConfirmations")} label="Confirmation par WhatsApp" disabled={!waReady && !f.whatsappConfirmations} />
        </div>
        <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted"><MessageCircle className="size-3.5" aria-hidden="true" />Même quota et même solde que les SMS.</p>
      </Card>

      {isOwner ? (
        <Card>
          <CardHeader title="Recharge automatique" description="Quand le solde passe sous le seuil, votre carte est débitée du montant choisi." />
          <div className="flex flex-wrap items-end gap-4 p-5">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ar.enabled} onChange={(e) => setAr({ ...ar, enabled: e.target.checked })} className="size-4 accent-[var(--accent)]" />Activer</label>
            <label className="text-sm">Seuil
              <Select value={String(ar.thresholdCents)} onChange={(e) => setAr({ ...ar, thresholdCents: Number(e.target.value) })} className="mt-1 w-28">{[200, 500, 1000].map((c) => <option key={c} value={c}>{eur(c)}</option>)}</Select>
            </label>
            <label className="text-sm">Montant
              <Select value={String(ar.amountCents)} onChange={(e) => setAr({ ...ar, amountCents: Number(e.target.value) })} className="mt-1 w-28">{[1000, 2000, 5000].map((c) => <option key={c} value={c}>{eur(c)}</option>)}</Select>
            </label>
            <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => saveAutoRecharge(ar))}>Enregistrer</Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

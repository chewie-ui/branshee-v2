"use client";

import { useBrandName } from "@/components/brand-context";
import { useState, useTransition } from "react";
import { MessageCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { saveAutoRecharge, saveSmsSettings, topUpSms } from "@/server/actions/sms";
import { useT } from "@/components/app-locale";

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

export function SmsPanel({ initial, included, used, balanceCents, autoRecharge, smsReady, waReady, isOwner, prices, businessName: bn }: { businessName?: string; initial: Flags; included: number; used: number; balanceCents: number; autoRecharge: { enabled: boolean; thresholdCents: number; amountCents: number }; smsReady: boolean; waReady: boolean; isOwner: boolean; prices: { sms: number; wa: number } }) {
  const t = useT();
  const businessName = bn ?? t("votre établissement");
  const brandName = useBrandName();
  const [f, setF] = useState(initial);
  const [ar, setAr] = useState(autoRecharge);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<R>) => start(async () => { const r = await fn(); if (r.ok && r.url) { window.location.href = r.url; return; } setMsg(r.ok ? { ok: true, text: r.message ?? t("Fait.") } : { ok: false, text: r.error }); });
  const set = (k: keyof Flags) => (v: boolean) => { const next = { ...f, [k]: v }; setF(next); run(() => saveSmsSettings(next)); };

  return (
    <div className="space-y-6">
      {msg ? <p className={cn("rounded-lg p-3 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role="status">{t(msg.text)}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-muted">{t("Ce mois-ci")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{Math.min(used, included)} / {included}</p>
          <p className="text-sm text-muted">{t("messages inclus dans votre forfait")}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full bg-accent" style={{ width: `${included ? Math.min(100, (used / included) * 100) : 0}%` }} /></div>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">{t("Solde prépayé")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{eur(balanceCents)}</p>
          <p className="text-sm text-muted">SMS {eur(prices.sms)} · WhatsApp {eur(prices.wa)} au-delà du forfait</p>
          {isOwner ? <p className="text-xs text-muted">{t("Montants TVA comprise.")}</p> : null}
          {isOwner ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {[10, 20, 50].map((a) => <Button key={a} size="sm" variant="secondary" loading={pending} onClick={() => run(() => topUpSms(a))}>+ {a} €</Button>)}
            </div>
          ) : null}
        </Card>
      </div>

      <Card>
        <CardHeader title="WhatsApp" description={waReady ? (smsReady ? t("Prioritaire et moins cher que le SMS ; repli SMS puis email.") : t("Envoyé au numéro du client ; si l'envoi est impossible, l'email part à la place.")) : t("WhatsApp arrive bientôt : en attendant, rappels par SMS ou e-mail.")} />
        <div className="divide-y divide-border">
          <Switch checked={f.whatsappReminders} onChange={set("whatsappReminders")} label={t("Rappel par WhatsApp")} description={t("Remplace l'email de rappel, au même moment.")} disabled={!waReady && !f.whatsappReminders} />
          <Switch checked={f.whatsappConfirmations} onChange={set("whatsappConfirmations")} label={t("Confirmation par WhatsApp")} description={t("En plus de l'email de confirmation.")} disabled={!waReady && !f.whatsappConfirmations} />
        </div>
        {waReady ? (
          <div className="border-t border-border bg-surface-muted px-5 py-4 text-sm">
            <p className="mb-1 flex items-center gap-2 font-medium"><MessageCircle className="size-4" aria-hidden="true" />{t("Aperçu")}</p>
            <p className="text-muted">{t("Bonjour Marie, votre rendez-vous chez")} <span className="text-text">{businessName}</span> {t("est confirmé pour le jeudi 12 mars à 10:30. À bientôt !")}</p>
          </div>
        ) : null}
      </Card>

      {smsReady ? (
        <Card>
          <CardHeader title="SMS" description={waReady ? t("Utilisé si WhatsApp n'a pas pu partir ; sinon l'email part à la place.") : t("Envoyés au numéro du client ; si l'envoi est impossible, l'email part à la place.")} />
          <div className="divide-y divide-border">
            <Switch checked={f.smsReminders} onChange={set("smsReminders")} label={t("Rappel par SMS")} description={t("Remplace l'email de rappel, au même moment.")} />
            <Switch checked={f.smsConfirmations} onChange={set("smsConfirmations")} label={t("SMS de confirmation")} description={t("En plus de l'email de confirmation.")} />
          </div>
          <div className="border-t border-border bg-surface-muted px-5 py-4 text-sm">
            <p className="mb-1 flex items-center gap-2 font-medium"><Smartphone className="size-4" aria-hidden="true" />{t("Aperçu")}</p>
            <p className="text-muted">{t("Rappel : votre rendez-vous chez")} <span className="text-text">{businessName}</span> est jeudi 12 mars à 10:30. Gérer : {brandName === "Skydev" ? "skydev.be" : "branshee.com"}/r/…</p>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={t("Au-delà des messages inclus")} description={`${included} ${t("messages inclus chaque mois, communs à WhatsApp et aux SMS.")}`} />
        <Switch checked={f.smsAllowOverage} onChange={set("smsAllowOverage")} label={t("Continuer avec le solde prépayé")} description={t("Les messages suivants sont pris sur le solde prépayé. Sinon : repli sur l'email.")} />
      </Card>

      {isOwner ? (
        <Card>
          <CardHeader title={t("Recharge automatique")} description={t("Quand le solde passe sous le seuil, votre carte est débitée du montant choisi.")} />
          <div className="flex flex-wrap items-end gap-4 p-5">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ar.enabled} onChange={(e) => setAr({ ...ar, enabled: e.target.checked })} className="size-4 accent-[var(--accent)]" />{t("Activer")}</label>
            <label className="text-sm">{t("Seuil")}
              <Select value={String(ar.thresholdCents)} onChange={(e) => setAr({ ...ar, thresholdCents: Number(e.target.value) })} className="mt-1 w-28">{[200, 500, 1000].map((c) => <option key={c} value={c}>{eur(c)}</option>)}</Select>
            </label>
            <label className="text-sm">{t("Montant")}
              <Select value={String(ar.amountCents)} onChange={(e) => setAr({ ...ar, amountCents: Number(e.target.value) })} className="mt-1 w-28">{[1000, 2000, 5000].map((c) => <option key={c} value={c}>{eur(c)}</option>)}</Select>
            </label>
            <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => saveAutoRecharge(ar))}>Enregistrer</Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

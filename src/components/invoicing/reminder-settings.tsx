"use client";

import { useState, useTransition } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { saveReminderSettings } from "@/server/actions/invoice-mailing";

type Rule = { enabled: boolean; firstDays: number; everyDays: number; maxReminders: number };

/** Relances automatiques des factures échues (Skydev). */
export function ReminderSettings({ initial, canManage }: { initial: Rule; canManage: boolean }) {
  const [r, setR] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res: { ok: boolean; message?: string; error?: string } = await saveReminderSettings(r).catch(() => ({ ok: false, error: "Enregistrement impossible. Vérifiez votre connexion." }));
      setMsg({ ok: res.ok, text: res.ok ? (res.message ?? "Enregistré.") : (res.error ?? "Enregistrement impossible.") });
    });
  return (
    <Card id="relances" className="mt-6 scroll-mt-8">
      <CardHeader title="Rappels de paiement automatiques" description="Pour les factures envoyées depuis Skydev : un email poli au client quand l'échéance est dépassée, avec le lien pour payer. Arrêt automatique dès que la facture est marquée payée." />
      <div className="space-y-4 p-5 text-sm">
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" className="size-4" checked={r.enabled} disabled={!canManage} onChange={(e) => setR({ ...r, enabled: e.target.checked })} />
          Relancer automatiquement les factures impayées
        </label>
        <div className={cn("grid gap-3 sm:grid-cols-3", !r.enabled && "opacity-60")}>
          <Field label="Premier rappel" htmlFor="rm-first">
            <Select id="rm-first" value={r.firstDays} disabled={!canManage || !r.enabled} onChange={(e) => setR({ ...r, firstDays: Number(e.target.value) })}>{[1, 3, 5, 7, 10, 15].map((d) => <option key={d} value={d}>{d} jour{d > 1 ? "s" : ""} après l&apos;échéance</option>)}</Select>
          </Field>
          <Field label="Puis tous les" htmlFor="rm-every">
            <Select id="rm-every" value={r.everyDays} disabled={!canManage || !r.enabled} onChange={(e) => setR({ ...r, everyDays: Number(e.target.value) })}>{[5, 7, 10, 14, 30].map((d) => <option key={d} value={d}>{d} jours</option>)}</Select>
          </Field>
          <Field label="Au plus" htmlFor="rm-max">
            <Select id="rm-max" value={r.maxReminders} disabled={!canManage || !r.enabled} onChange={(e) => setR({ ...r, maxReminders: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} rappel{n > 1 ? "s" : ""}</option>)}</Select>
          </Field>
        </div>
        {canManage ? <Button icon={<BellRing className="size-4" aria-hidden="true" />} loading={pending} onClick={save}>Enregistrer</Button> : null}
        {msg ? <p className={cn("rounded-lg px-3 py-2", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      </div>
    </Card>
  );
}

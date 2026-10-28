"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { regenerateReviewQr, saveReviewSettings } from "@/server/actions/google-reviews";

type S = { googleUrl: string; autoSend: boolean; delayHours: number; minDaysBetween: number; message: string };

export function ReviewSettingsForm({ initial, defaultMessage }: { initial: S; defaultMessage: string }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r: { ok: boolean; message?: string; error?: string } = await fn().catch(() => ({ ok: false, error: "Enregistrement impossible. Vérifiez votre connexion." }));
      setMsg(r.ok ? { ok: true, text: r.message ?? "Enregistré." } : { ok: false, text: r.error ?? "Enregistrement impossible." });
      router.refresh();
    });
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => saveReviewSettings(f)); }} className="max-w-2xl space-y-4" noValidate>
      <Card className="space-y-4 p-5">
        <Field label="Lien de votre fiche Google" htmlFor="rs-url" hint="Sur Google Business Profile : « Demander des avis » → copiez le lien (g.page/r/…). L'identifiant de lieu (ChIJ…) marche aussi.">
          <Input id="rs-url" value={f.googleUrl} onChange={(e) => setF({ ...f, googleUrl: e.target.value })} placeholder="https://g.page/r/…/review" maxLength={500} />
        </Field>
        {f.googleUrl ? <a href={f.googleUrl.startsWith("http") ? f.googleUrl : `https://${f.googleUrl}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent hover:text-accent-hover">Tester le lien</a> : null}
      </Card>
      <Card className="space-y-4 p-5">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={f.autoSend} onChange={(e) => setF({ ...f, autoSend: e.target.checked })} className="mt-1 size-4" />
          <span><span className="font-medium">Demander un avis après chaque rendez-vous</span><span className="block text-sm text-muted">Un email part automatiquement au client quand le rendez-vous est terminé (pas en cas d&apos;absence ni d&apos;annulation).</span></span>
        </label>
        <div className={cn("grid gap-4 sm:grid-cols-2", !f.autoSend && "opacity-60")}>
          <Field label="Délai après le rendez-vous" htmlFor="rs-delay">
            <Select id="rs-delay" value={f.delayHours} onChange={(e) => setF({ ...f, delayHours: Number(e.target.value) })} disabled={!f.autoSend}>
              {[1, 2, 4, 8, 24, 48].map((h) => <option key={h} value={h}>{h < 24 ? `${h} heure${h > 1 ? "s" : ""}` : `${h / 24} jour${h > 24 ? "s" : ""}`}</option>)}
            </Select>
          </Field>
          <Field label="Pas plus d'une demande par client tous les" htmlFor="rs-min">
            <Select id="rs-min" value={f.minDaysBetween} onChange={(e) => setF({ ...f, minDaysBetween: Number(e.target.value) })} disabled={!f.autoSend}>
              {[[30, "1 mois"], [90, "3 mois"], [180, "6 mois"], [365, "1 an"], [730, "2 ans"]].map(([d, l]) => <option key={d} value={d}>{l}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Message (facultatif)" htmlFor="rs-msg" hint="Laissé vide, ce message est utilisé.">
          <Textarea id="rs-msg" rows={3} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} maxLength={500} placeholder={defaultMessage} />
        </Field>
      </Card>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>Enregistrer</Button>
        <Button type="button" variant="ghost" disabled={pending} icon={<RefreshCw className="size-4" aria-hidden="true" />} onClick={() => run(() => regenerateReviewQr())}>Nouveau QR code du comptoir</Button>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellOff, BellRing, Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { sendInvoiceByEmail, setInvoiceReminders } from "@/server/actions/invoice-mailing";
import { useT } from "@/components/app-locale";
import { intlLocale } from "@/lib/i18n/app";

export type MailingView = { email: string; sentAt: string; viewedAt: string | null; remindersSent: number; remindersOff: boolean; url: string };
type Res = { ok: boolean; message?: string; error?: string };

/** Fiche d'une facture émise : l'envoyer au client par email, suivre l'ouverture et les rappels automatiques. */
export function InvoiceMailPanel({ documentId, defaultEmail, mailing, remindersOn, canManage, unpaid, credit }: { documentId: string; defaultEmail: string; mailing: MailingView | null; remindersOn: boolean; canManage: boolean; unpaid: boolean; credit: boolean }) {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState(mailing?.email ?? defaultEmail);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fmt = (iso: string) => new Intl.DateTimeFormat(intlLocale(t.locale), { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  const run = (fn: () => Promise<Res>) =>
    start(async () => {
      const r: Res = await fn().catch(() => ({ ok: false, error: t("Action impossible. Vérifiez votre connexion.") }));
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? t("Fait.")) : (r.error ?? t("Action impossible.")) });
      router.refresh();
    });
  return (
    <Card>
      <CardHeader title={t("Envoi au client")} description={mailing ? undefined : credit ? t("Le client reçoit un lien pour voir et télécharger la note de crédit.") : t("Le client reçoit un lien pour voir, télécharger et payer la facture (QR code bancaire).")} />
      <div className="space-y-3 p-5 text-sm">
        {mailing ? (
          <>
            <p>
              <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", mailing.viewedAt ? "bg-accent-soft text-accent" : "bg-surface-muted text-muted")}>{mailing.viewedAt ? t("Ouverte par le client") : "Envoyée"}</span> à {mailing.email}, le {fmt(mailing.sentAt)}
            </p>
            {mailing.remindersSent ? <p className="text-muted">{mailing.remindersSent} rappel{mailing.remindersSent > 1 ? "s" : ""} automatique{mailing.remindersSent > 1 ? "s" : ""} envoyé{mailing.remindersSent > 1 ? "s" : ""}.</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={<Copy className="size-4" aria-hidden="true" />} onClick={() => navigator.clipboard?.writeText(mailing.url).then(() => setMsg({ ok: true, text: t("Lien copié : envoyez-le par WhatsApp ou SMS si vous préférez.") }), () => {})}>{t("Copier le lien")}</Button>
              {canManage && unpaid && !credit && remindersOn ? (
                mailing.remindersOff ? (
                  <Button size="sm" variant="ghost" icon={<BellRing className="size-4" aria-hidden="true" />} disabled={pending} onClick={() => run(() => setInvoiceReminders(documentId, true))}>{t("Réactiver les rappels")}</Button>
                ) : (
                  <Button size="sm" variant="ghost" icon={<BellOff className="size-4" aria-hidden="true" />} disabled={pending} onClick={() => run(() => setInvoiceReminders(documentId, false))}>{t("Ne plus relancer")}</Button>
                )
              ) : null}
            </div>
          </>
        ) : null}
        {canManage ? (
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => sendInvoiceByEmail(documentId, email)); }}>
            <label htmlFor="im-email" className="block font-medium">{mailing ? t("Renvoyer à") : t("Email du client")}</label>
            <Input id="im-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
            <Button type="submit" size="sm" loading={pending} disabled={!email} icon={<Send className="size-4" aria-hidden="true" />}>{mailing ? "Renvoyer" : credit ? t("Envoyer la note de crédit") : t("Envoyer la facture")}</Button>
          </form>
        ) : null}
        {!credit && unpaid ? (
          <p className="text-xs text-muted">
            {remindersOn ? t("Rappels automatiques activés si la facture dépasse son échéance.") : t("Rappels automatiques désactivés.")}{" "}
            <Link href="/app/factures/reglages#relances" className="font-medium text-accent hover:text-accent-hover">Régler</Link>
          </p>
        ) : null}
        {msg ? <p className={cn("rounded-lg px-3 py-2", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{t(msg.text)}</p> : null}
      </div>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { CreditCard, Landmark, Lock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { useT } from "@/components/app-locale";
import { finishAddPaymentMethod, removePaymentMethod, setDefaultPaymentMethod, startAddPaymentMethod } from "@/server/actions/billing-methods";
import type { PaymentMethodView } from "@/server/billing-methods";

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => (stripePromise ??= loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""));
const accent = () => (typeof window === "undefined" ? "#4f46e5" : getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#4f46e5");

/** Moyens de paiement de l'abonnement : ajouter (formulaire sécurisé Stripe), choisir celui par défaut, retirer. */
export function PaymentMethods({ methods, canManage, enabled }: { methods: PaymentMethodView[]; canManage: boolean; enabled: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const act = (id: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => {
    setBusyId(id);
    setMsg(null);
    start(async () => {
      const r = await fn();
      setBusyId(null);
      setConfirmId(null);
      setMsg({ ok: r.ok, text: (r.ok ? r.message : r.error) ?? "" });
      router.refresh();
    });
  };

  const openAdd = () => {
    setMsg(null);
    setBusyId("add");
    start(async () => {
      const r = await startAddPaymentMethod();
      setBusyId(null);
      if (r.ok && r.clientSecret) setSecret(r.clientSecret);
      else setMsg({ ok: false, text: r.ok ? "" : r.error });
    });
  };

  return (
    <Card id="paiement">
      <CardHeader
        title={t("Moyens de paiement")}
        description={t("La carte ou le compte prélevé pour votre abonnement. Ajoutez-en plusieurs : celui « par défaut » est utilisé, les autres servent de secours.")}
        action={canManage && enabled && !secret ? <Button size="sm" onClick={openAdd} loading={busyId === "add"} icon={<Plus className="size-4" aria-hidden="true" />}>{t("Ajouter")}</Button> : null}
      />
      {methods.length === 0 && !secret ? (
        <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted">
          <CreditCard className="size-8" aria-hidden="true" />
          <p>{enabled ? t("Aucun moyen de paiement enregistré.") : t("Le paiement n'est pas encore configuré sur ce serveur.")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {methods.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted">
                {m.kind === "sepa" ? <Landmark className="size-5" aria-hidden="true" /> : <CreditCard className="size-5" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {m.label}
                  {m.isDefault ? <Badge tone="accent">{t("Par défaut")}</Badge> : null}
                  {m.expired ? <Badge tone="danger">{t("Expirée")}</Badge> : null}
                </p>
                {m.detail ? <p className="text-xs text-muted">{t(m.detail)}</p> : null}
              </div>
              {canManage ? (
                <div className="flex flex-wrap items-center gap-2">
                  {confirmId === m.id ? (
                    <>
                      <span className="text-sm text-muted">{t("Retirer ce moyen de paiement ?")}</span>
                      <Button size="sm" variant="danger" loading={pending && busyId === m.id} onClick={() => act(m.id, () => removePaymentMethod(m.id))}>{t("Retirer")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)} disabled={pending}>{t("Annuler")}</Button>
                    </>
                  ) : (
                    <>
                      {!m.isDefault ? <Button size="sm" variant="secondary" loading={pending && busyId === m.id} onClick={() => act(m.id, () => setDefaultPaymentMethod(m.id))}>{t("Utiliser par défaut")}</Button> : null}
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(m.id)} disabled={pending}>{t("Retirer")}</Button>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {secret ? (
        <div className={cn("p-5", methods.length ? "border-t border-border" : "")}>
          <Elements stripe={getStripe()} options={{ clientSecret: secret, locale: "fr", appearance: { theme: "stripe", variables: { colorPrimary: accent() } } }}>
            <AddForm
              onCancel={() => setSecret(null)}
              onDone={(r) => {
                setSecret(null);
                setMsg({ ok: r.ok, text: (r.ok ? r.message : r.error) ?? "" });
                router.refresh();
              }}
            />
          </Elements>
        </div>
      ) : null}
      {msg?.text ? <p className={cn("border-t border-border px-5 py-3 text-sm", msg.ok ? "text-success" : "text-danger")} role={msg.ok ? "status" : "alert"}>{t(msg.text)}</p> : null}
    </Card>
  );
}

function AddForm({ onCancel, onDone }: { onCancel: () => void; onDone: (r: { ok: boolean; message?: string; error?: string }) => void }) {
  const t = useT();
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const res = await stripe.confirmSetup({ elements, redirect: "if_required" });
    if (res.error) {
      setBusy(false);
      return setError(res.error.message ?? t("Le moyen de paiement a été refusé."));
    }
    const r = await finishAddPaymentMethod(res.setupIntent.id);
    setBusy(false);
    onDone(r);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{t("Nouveau moyen de paiement")}</p>
      <PaymentElement options={{ layout: "tabs" }} />
      {error ? <p className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger" role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} loading={busy} disabled={!stripe} icon={<Lock className="size-4" aria-hidden="true" />}>{t("Enregistrer")}</Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>{t("Annuler")}</Button>
      </div>
      <p className="text-xs text-muted">{t("Saisie sécurisée par Stripe : vos coordonnées bancaires ne passent jamais par nos serveurs. Rien n'est prélevé maintenant.")}</p>
    </div>
  );
}

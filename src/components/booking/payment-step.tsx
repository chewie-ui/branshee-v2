"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => (stripePromise ??= loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""));

/**
 * Étape de paiement Stripe : paiement immédiat ou carte en garantie (0 € prélevé).
 * La carte est saisie chez Stripe (iframe) : elle ne transite jamais par Branshee.
 */
export function PaymentStep({ clientSecret, mode, amountLabel, ruleText, onDone, onBack }: { clientSecret: string; mode: "pay" | "guarantee"; amountLabel: string; ruleText: string | null; onDone: (intentId: string) => void; onBack: () => void }) {
  return (
    <Elements stripe={getStripe()} options={{ clientSecret, locale: "fr", appearance: { theme: "stripe", variables: { colorPrimary: getComputedStyleSafe("--accent") } } }}>
      <Inner mode={mode} amountLabel={amountLabel} ruleText={ruleText} onDone={onDone} onBack={onBack} />
    </Elements>
  );
}

function getComputedStyleSafe(v: string) {
  if (typeof window === "undefined") return "#4f46e5";
  return getComputedStyle(document.getElementById("bp-root") ?? document.documentElement).getPropertyValue(v).trim() || "#4f46e5";
}

function Inner({ mode, amountLabel, ruleText, onDone, onBack }: { mode: "pay" | "guarantee"; amountLabel: string; ruleText: string | null; onDone: (intentId: string) => void; onBack: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const res =
      mode === "pay"
        ? await stripe.confirmPayment({ elements, redirect: "if_required" })
        : await stripe.confirmSetup({ elements, redirect: "if_required" });
    setBusy(false);
    if (res.error) return setError(res.error.message ?? "Paiement refusé.");
    const intent = "paymentIntent" in res ? res.paymentIntent : res.setupIntent;
    if (intent && (intent.status === "succeeded")) onDone(intent.id);
    else setError("Le paiement n'est pas encore validé. Réessayez.");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-surface-muted p-4 text-sm">
        {mode === "pay" ? (
          <p className="font-medium">Montant à payer : {amountLabel}</p>
        ) : (
          <>
            <p className="font-medium">Carte en garantie — rien n&apos;est prélevé maintenant</p>
            {ruleText ? <p className="mt-1 text-muted">{ruleText}</p> : null}
          </>
        )}
      </div>
      <PaymentElement options={{ layout: "tabs" }} />
      {error ? <p className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger" role="alert">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack} disabled={busy}>Retour</Button>
        <Button className="flex-1" onClick={confirm} loading={busy} disabled={!stripe} icon={<Lock className="size-4" aria-hidden="true" />}>
          {mode === "pay" ? `Payer ${amountLabel} et réserver` : "Enregistrer la carte et réserver"}
        </Button>
      </div>
      <p className="text-center text-xs text-muted">Paiement sécurisé par Stripe. Vos données bancaires ne sont jamais stockées par Branshee.</p>
    </div>
  );
}

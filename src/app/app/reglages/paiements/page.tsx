import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentSettings } from "@/db/schema";
import { PaymentsForm, StripeCard } from "@/components/settings/payments-form";
import { requireContext } from "@/server/context";
import { stripeEnabled } from "@/server/payments";

export const metadata: Metadata = { title: "Paiements · Réglages" };

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: "Compte Stripe connecté : vous pouvez recevoir des paiements en ligne." },
  incomplet: { ok: false, text: "L'inscription Stripe n'est pas terminée. Reprenez-la quand vous voulez." },
  erreur: { ok: false, text: "Stripe n'a pas pu être contacté. Réessayez dans un instant." },
  non_configure: { ok: false, text: "Le paiement en ligne n'est pas configuré sur ce serveur." },
};

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const ctx = await requireContext("billing.manage");
  const [ps] = await db.select().from(paymentSettings).where(eq(paymentSettings.businessId, ctx.business.id));
  const notice = NOTICES[(await searchParams).stripe ?? ""];
  const p = {
    stripeConfigured: stripeEnabled(),
    stripe: { status: ps!.stripeStatus, email: ps!.stripeAccountEmail, accountId: ps!.stripeAccountId },
    prepaymentEnabled: ps!.prepaymentEnabled,
    prepaymentRequired: ps!.prepaymentRequired,
    cancellationRule: ps!.cancellationRule,
    accepted: ps!.accepted,
    payout: ps!.payout,
  };
  return (
    <div className="space-y-6">
      {notice ? <p className={notice.ok ? "rounded-lg bg-success-soft p-3 text-sm text-success" : "rounded-lg bg-warning-soft p-3 text-sm text-warning"} role="status">{notice.text}</p> : null}
      <StripeCard p={p} />
      <PaymentsForm p={p} />
    </div>
  );
}

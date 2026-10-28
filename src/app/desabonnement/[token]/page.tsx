import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, campaignRecipients } from "@/db/schema";
import { UnsubscribeButton } from "@/components/marketing/unsubscribe-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Se désabonner" }, robots: { index: false, follow: false } };

/** Page de désabonnement : un bouton à confirmer (un simple passage sur le lien ne désabonne pas, à cause des antivirus). */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{16,40}$/.test(token)) notFound();
  const [r] = await db.select({ name: businesses.name, done: campaignRecipients.unsubscribedAt }).from(campaignRecipients).innerJoin(businesses, eq(businesses.id, campaignRecipients.businessId)).where(eq(campaignRecipients.token, token));
  if (!r) notFound();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Emails de {r.name}</h1>
        <UnsubscribeButton token={token} done={!!r.done} />
      </div>
    </div>
  );
}

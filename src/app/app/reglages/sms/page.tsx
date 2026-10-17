import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, notificationSettings } from "@/db/schema";
import { UpgradeNotice } from "@/components/app/upgrade-notice";
import { SmsPanel } from "@/components/settings/sms-panel";
import { LIMITS } from "@/lib/plans";
import { requireContext } from "@/server/context";
import { effectivePlan } from "@/server/plan";
import { SMS_PRICE_CENTS, WHATSAPP_PRICE_CENTS, smsConfigured, usageThisMonth, whatsappConfigured } from "@/server/sms";

export const metadata: Metadata = { title: "SMS et WhatsApp · Réglages" };

export default async function SmsPage({ searchParams }: { searchParams: Promise<{ recharge?: string }> }) {
  const ctx = await requireContext("settings.manage");
  const [[n], [b], plan] = await Promise.all([
    db.select().from(notificationSettings).where(eq(notificationSettings.businessId, ctx.business.id)),
    db.select({ ownerId: businesses.ownerId }).from(businesses).where(eq(businesses.id, ctx.business.id)),
    effectivePlan(ctx.business.id),
  ]);
  const usage = await usageThisMonth(b!.ownerId);
  const recharge = (await searchParams).recharge;
  if (plan.plan === "free") return <UpgradeNotice feature="Rappels par SMS et WhatsApp" required="pro">Le forfait Pro inclut {LIMITS.smsIncluded.pro} SMS par mois (Pro+ : {LIMITS.smsIncluded.pro_plus}), puis un solde prépayé si vous le souhaitez.</UpgradeNotice>;
  return (
    <div className="space-y-4">
      {recharge === "ok" ? <p className="rounded-lg bg-success-soft p-3 text-sm text-success">Solde rechargé, merci !</p> : recharge === "erreur" ? <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">La recharge n&apos;a pas pu être vérifiée. Si vous avez été débité, contactez le support.</p> : null}
      <SmsPanel
        initial={{ smsReminders: n!.smsReminders, smsConfirmations: n!.smsConfirmations, smsAllowOverage: n!.smsAllowOverage, whatsappReminders: n!.whatsappReminders, whatsappConfirmations: n!.whatsappConfirmations }}
        included={LIMITS.smsIncluded[plan.plan]}
        used={usage.used}
        balanceCents={usage.balanceCents}
        autoRecharge={usage.autoRecharge}
        smsReady={smsConfigured()}
        waReady={whatsappConfigured()}
        isOwner={b!.ownerId === ctx.user.id}
        prices={{ sms: SMS_PRICE_CENTS, wa: WHATSAPP_PRICE_CENTS }}
      />
    </div>
  );
}

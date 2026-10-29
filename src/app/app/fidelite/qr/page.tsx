import type { Metadata } from "next";
import Link from "next/link";
import { LoyaltyQrScreen } from "@/components/loyalty/qr-screen";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { loyaltyRights, loyaltySettingsOf } from "@/server/loyalty";

export const metadata: Metadata = { title: "QR code fidélité" };

export default async function LoyaltyQrPage() {
  const ctx = await requireContext(undefined, { app: "fidelite" });
  const s = await loyaltySettingsOf(ctx.business.id);
  return (
    <>
      <PageHeader title="QR code à scanner" description="Montrez cet écran à votre client : il scanne avec l'appareil photo de son téléphone et reçoit son tampon." />
      {s.qrEnabled ? (
        <LoyaltyQrScreen business={ctx.business.name} goal={s.goal} reward={s.reward} />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
          Le tampon par QR code n&apos;est pas activé.{" "}
          {loyaltyRights(ctx).manage ? <Link href="/app/fidelite" className="font-medium text-accent hover:text-accent-hover">Activez-le dans votre programme</Link> : "Demandez au responsable de l'activer."}
        </div>
      )}
    </>
  );
}

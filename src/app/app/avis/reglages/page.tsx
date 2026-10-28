import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReviewSettingsForm } from "@/components/reviews/review-settings";
import { PageHeader } from "@/components/ui/page-header";
import { DEFAULT_MESSAGE } from "@/lib/google-reviews";
import { requireContext } from "@/server/context";
import { reviewRights, reviewSettingsOf } from "@/server/google-reviews";

export const metadata: Metadata = { title: "Réglages des avis" };

export default async function ReviewSettingsPage() {
  const ctx = await requireContext();
  if (!reviewRights(ctx).settings) redirect("/app/avis");
  const s = await reviewSettingsOf(ctx.business.id);
  return (
    <>
      <PageHeader title="Réglages des avis" description="Le lien de votre fiche Google et l'envoi automatique après les rendez-vous." />
      <ReviewSettingsForm initial={{ googleUrl: s.googleUrl ?? "", autoSend: s.autoSend, delayHours: s.delayHours, minDaysBetween: s.minDaysBetween, message: s.message ?? "" }} defaultMessage={DEFAULT_MESSAGE} />
    </>
  );
}

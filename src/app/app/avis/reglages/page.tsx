import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReviewSettingsForm } from "@/components/reviews/review-settings";
import { PageHeader } from "@/components/ui/page-header";
import { DEFAULT_MESSAGE } from "@/lib/google-reviews";
import { requireContext } from "@/server/context";
import { reviewRights, reviewSettingsOf } from "@/server/google-reviews";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Réglages des avis");

export default async function ReviewSettingsPage() {
  const t = await appT();
  const ctx = await requireContext();
  if (!reviewRights(ctx).settings) redirect("/app/avis");
  const s = await reviewSettingsOf(ctx.business.id);
  return (
    <>
      <PageHeader title={t("Réglages des avis")} description={t("Le lien de votre fiche Google et l'envoi automatique après les rendez-vous.")} />
      <ReviewSettingsForm initial={{ googleUrl: s.googleUrl ?? "", autoSend: s.autoSend, delayHours: s.delayHours, minDaysBetween: s.minDaysBetween, message: s.message ?? "" }} defaultMessage={DEFAULT_MESSAGE} />
    </>
  );
}

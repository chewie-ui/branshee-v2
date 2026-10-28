import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reviewRequests } from "@/db/schema";
import { ReviewLanding } from "@/components/reviews/review-landing";
import { requestByToken } from "@/server/google-reviews";
import { publicTexts } from "@/i18n/public-pages";
import { resolvePublicLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Votre avis" }, robots: { index: false, follow: false } };

/** Page ouverte depuis l'email ou le QR code : Google pour tout le monde, et une remarque privée possible. */
export default async function ReviewPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string }> }) {
  const locale = await resolvePublicLocale((await searchParams).lang);
  const { token } = await params;
  const r = await requestByToken(token);
  if (!r) notFound();
  if (!r.req.openedAt) await db.update(reviewRequests).set({ openedAt: new Date() }).where(eq(reviewRequests.id, r.req.id));
  return <ReviewLanding token={token} businessName={r.business.name} photoUrl={r.business.photoUrl} hasGoogle={!!r.googleUrl} alreadySent={!!r.req.feedbackAt} tx={publicTexts(locale).review} />;
}

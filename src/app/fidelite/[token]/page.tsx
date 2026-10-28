import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gift, Star } from "lucide-react";
import { cardByToken, loyaltySettingsOf } from "@/server/loyalty";
import { fill, publicTexts } from "@/i18n/public-pages";
import { resolvePublicLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Ma carte de fidélité" }, robots: { index: false, follow: false } };

/** Carte de fidélité du client, à garder sur l'écran d'accueil du téléphone. */
export default async function PublicLoyaltyCard({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string }> }) {
  const tx = publicTexts(await resolvePublicLocale((await searchParams).lang)).loyalty;
  const c = await cardByToken((await params).token);
  if (!c) notFound();
  const s = await loyaltySettingsOf(c.businessId);
  const ready = c.stamps >= s.goal;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm rounded-3xl bg-accent p-6 text-accent-foreground shadow-lg">
        <p className="text-sm opacity-90">{c.business}</p>
        <h1 className="mt-1 text-2xl font-semibold">{tx.card}</h1>
        <p className="mt-1 opacity-90">{c.name ?? c.fullName.split(" ")[0]}</p>
        <ul className="mt-6 grid grid-cols-5 gap-3" aria-label={fill(tx.stamps, { n: Math.min(c.stamps, s.goal), goal: s.goal })}>
          {Array.from({ length: s.goal }, (_, i) => <li key={i} className={`flex aspect-square items-center justify-center rounded-full border-2 border-white/70 ${i < c.stamps ? "bg-white text-accent" : ""}`}>{i < c.stamps ? <Star className="size-5 fill-current" aria-hidden="true" /> : null}</li>)}
        </ul>
        <p className="mt-6 rounded-xl bg-white/15 px-4 py-3 text-sm">{ready ? <><Gift className="mr-1.5 inline size-4" aria-hidden="true" />{fill(tx.reward, { reward: s.reward })}</> : fill(tx.left, { n: s.goal - c.stamps, reward: s.reward })}</p>
        {c.rewards ? <p className="mt-3 text-xs opacity-80">{fill(tx.earned, { n: c.rewards })}</p> : null}
      </div>
    </div>
  );
}

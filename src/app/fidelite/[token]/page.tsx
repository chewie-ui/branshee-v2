import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gift, Star } from "lucide-react";
import { cardByToken, loyaltySettingsOf } from "@/server/loyalty";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Ma carte de fidélité" }, robots: { index: false, follow: false } };

/** Carte de fidélité du client, à garder sur l'écran d'accueil du téléphone. */
export default async function PublicLoyaltyCard({ params }: { params: Promise<{ token: string }> }) {
  const c = await cardByToken((await params).token);
  if (!c) notFound();
  const s = await loyaltySettingsOf(c.businessId);
  const ready = c.stamps >= s.goal;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm rounded-3xl bg-accent p-6 text-accent-foreground shadow-lg">
        <p className="text-sm opacity-90">{c.business}</p>
        <h1 className="mt-1 text-2xl font-semibold">Carte de fidélité</h1>
        <p className="mt-1 opacity-90">{c.name ?? c.fullName.split(" ")[0]}</p>
        <ul className="mt-6 grid grid-cols-5 gap-3" aria-label={`${Math.min(c.stamps, s.goal)} tampons sur ${s.goal}`}>
          {Array.from({ length: s.goal }, (_, i) => <li key={i} className={`flex aspect-square items-center justify-center rounded-full border-2 border-white/70 ${i < c.stamps ? "bg-white text-accent" : ""}`}>{i < c.stamps ? <Star className="size-5 fill-current" aria-hidden="true" /> : null}</li>)}
        </ul>
        <p className="mt-6 rounded-xl bg-white/15 px-4 py-3 text-sm">{ready ? <><Gift className="mr-1.5 inline size-4" aria-hidden="true" />Récompense débloquée : {s.reward}. Demandez-la à votre prochain passage !</> : `Encore ${s.goal - c.stamps} passage${s.goal - c.stamps > 1 ? "s" : ""} pour : ${s.reward}`}</p>
        {c.rewards ? <p className="mt-3 text-xs opacity-80">{c.rewards} récompense{c.rewards > 1 ? "s" : ""} déjà obtenue{c.rewards > 1 ? "s" : ""}. Merci de votre fidélité !</p> : null}
      </div>
    </div>
  );
}

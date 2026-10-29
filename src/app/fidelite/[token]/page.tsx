import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Gift, Star } from "lucide-react";
import { cardByToken, cardHistory, loyaltySettingsOf } from "@/server/loyalty";
import { fill, publicTexts } from "@/i18n/public-pages";
import { resolvePublicLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Ma carte de fidélité" }, robots: { index: false, follow: false } };

/** Carte de fidélité du client, à garder sur l'écran d'accueil du téléphone. */
export default async function PublicLoyaltyCard({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string; tampon?: string }> }) {
  const sp = await searchParams;
  const locale = await resolvePublicLocale(sp.lang);
  const tx = publicTexts(locale).loyalty;
  const c = await cardByToken((await params).token);
  if (!c) notFound();
  const [s, moves] = await Promise.all([loyaltySettingsOf(c.businessId), cardHistory(c.id)]);
  const ready = c.stamps >= s.goal;
  const shown = Math.min(c.stamps, s.goal);
  const fmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : locale === "en" ? "en-GB" : "fr-BE", { day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="flex min-h-dvh justify-center bg-background p-4 sm:items-center">
      <div className="w-full max-w-sm space-y-4">
        {sp.tampon ? (
          <p className={`rounded-2xl px-4 py-3 text-center text-sm font-medium ${sp.tampon === "deja" ? "bg-surface text-muted" : "bg-success-soft text-success"}`} role="status">
            {sp.tampon === "deja" ? tx.already : tx.added}
          </p>
        ) : null}
        <div className="rounded-3xl bg-accent p-6 text-accent-foreground shadow-lg">
          <p className="text-sm opacity-90">{c.business}</p>
          <h1 className="mt-1 text-2xl font-semibold">{tx.card}</h1>
          <p className="mt-1 opacity-90">{c.name ?? c.fullName.split(" ")[0]}</p>
          <p className="mt-5 text-4xl font-semibold tabular-nums">{shown}<span className="text-xl opacity-80"> / {s.goal}</span></p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25" aria-hidden="true"><div className="h-full rounded-full bg-white" style={{ width: `${(shown / s.goal) * 100}%` }} /></div>
          <ul className="mt-5 grid grid-cols-5 gap-3" aria-label={fill(tx.stamps, { n: shown, goal: s.goal })}>
            {Array.from({ length: s.goal }, (_, i) => <li key={i} className={`flex aspect-square items-center justify-center rounded-full border-2 border-white/70 ${i < c.stamps ? "bg-white text-accent" : ""}`}>{i < c.stamps ? <Star className="size-5 fill-current" aria-hidden="true" /> : i === s.goal - 1 ? <Gift className="size-4 opacity-80" aria-hidden="true" /> : null}</li>)}
          </ul>
          <p className="mt-6 rounded-xl bg-white/15 px-4 py-3 text-sm">{ready ? <><Gift className="mr-1.5 inline size-4" aria-hidden="true" />{fill(tx.reward, { reward: s.reward })}</> : fill(tx.left, { n: s.goal - c.stamps, reward: s.reward })}</p>
          {c.rewards ? <p className="mt-3 text-xs opacity-80">{fill(tx.earned, { n: c.rewards })}</p> : null}
        </div>
        {moves.length ? (
          <section className="rounded-2xl bg-surface p-5" aria-labelledby="hist">
            <h2 id="hist" className="text-sm font-semibold">{tx.history}</h2>
            <ul className="mt-2 divide-y divide-border text-sm">
              {moves.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-muted">{m.kind === "reward" ? tx.src.reward : (tx.src[m.source as keyof typeof tx.src] ?? tx.src.manual)} · {fmt.format(m.at)}</span>
                  <span className={`font-medium tabular-nums ${m.delta > 0 ? "text-success" : "text-muted"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <Link href={`/${c.slug}`} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface text-sm font-medium transition-colors duration-150 hover:bg-surface-muted"><CalendarDays className="size-4" aria-hidden="true" />{tx.book}</Link>
        <p className="text-center text-xs text-muted">{tx.keep}</p>
      </div>
    </div>
  );
}

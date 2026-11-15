import { appPagePath } from "@/lib/brand";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Gift, ShoppingBag } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, services, shopSettings } from "@/db/schema";
import { LoyaltyCardView } from "@/components/loyalty/loyalty-card-view";
import { loyaltyColors, loyaltyFontHref, resolveLoyaltyTheme } from "@/lib/loyalty-theme";
import { cardByToken, cardHistory, loyaltySettingsOf } from "@/server/loyalty";
import { ClaimCard } from "@/components/loyalty/claim-card";
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
  const theme = resolveLoyaltyTheme(s.theme);
  // Boutons du bas selon ce que propose le commerce : boutique en ligne ouverte, prise de rendez-vous (prestations actives).
  const [[biz], [shop], [svc]] = await Promise.all([
    db.select({ o: businesses.onboarding }).from(businesses).where(eq(businesses.id, c.businessId)),
    db.select({ on: shopSettings.enabled }).from(shopSettings).where(eq(shopSettings.businessId, c.businessId)),
    db.select({ id: services.id }).from(services).where(and(eq(services.businessId, c.businessId), eq(services.isActive, true))).limit(1),
  ]);
  const hidden = new Set(biz?.o.hiddenApps ?? []);
  const offers = { shop: !!shop?.on && !hidden.has("boutique"), rdv: !!svc && !hidden.has("rdv") };
  const font = loyaltyFontHref(theme);
  const colors = loyaltyColors(theme);
  const fmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : locale === "en" ? "en-GB" : "fr-BE", { day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="flex min-h-dvh justify-center p-4 sm:items-center" style={{ background: colors.page }}>
      {font ? <link rel="stylesheet" href={font} /> : null}
      <div className="w-full max-w-sm space-y-4">
        {sp.tampon ? (
          <p className={`rounded-2xl px-4 py-3 text-center text-sm font-medium ${sp.tampon === "deja" ? "bg-surface text-muted" : "bg-success-soft text-success"}`} role="status">
            {sp.tampon === "deja" ? tx.already : tx.added}
          </p>
        ) : null}
        <LoyaltyCardView
          theme={theme}
          business={c.business}
          businessLogo={c.photoUrl}
          holder={c.hasEmail ? (c.name ?? c.fullName.split(" ")[0]) : null}
          stamps={c.stamps}
          goal={s.goal}
          title={tx.card}
          stampsLabel={fill(tx.stamps, { n: shown, goal: s.goal })}
          footer={ready ? <><Gift className="mr-1.5 inline size-4" aria-hidden="true" />{fill(tx.reward, { reward: s.reward })}</> : fill(tx.left, { n: s.goal - c.stamps, reward: s.reward })}
          earned={c.rewards ? fill(tx.earned, { n: c.rewards }) : null}
        />
        {!c.hasEmail ? <ClaimCard token={(await params).token} tx={{ saveTitle: tx.saveTitle, saveText: tx.saveText, firstName: tx.firstName, email: tx.email, save: tx.save, saving: tx.saving, saved: tx.saved, merged: tx.merged, account: tx.account }} signupHref="/inscription?client=1" /> : null}
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
        {offers.shop ? <Link href={`/boutique/${c.slug}`} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface text-sm font-medium transition-colors duration-150 hover:bg-surface-muted"><ShoppingBag className="size-4" aria-hidden="true" />{tx.order}</Link> : null}
        {offers.rdv ? <Link href={appPagePath(c.slug)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface text-sm font-medium transition-colors duration-150 hover:bg-surface-muted"><CalendarDays className="size-4" aria-hidden="true" />{tx.book}</Link> : null}
        <p className="text-center text-xs" style={{ color: colors.pageText }}>{tx.keep}</p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Gift } from "lucide-react";
import { STAMP_ICON } from "@/components/loyalty/loyalty-card-view";
import { loyaltyColors, resolveLoyaltyTheme } from "@/lib/loyalty-theme";

type CardRow = { token: string; stamps: number; business: string; goal: number; reward: string; photoUrl?: string | null; theme?: unknown };

/** Cartes de fidélité du client (espace client), aux couleurs de chaque entreprise : tampons, objectif, récompense. */
export function LoyaltyCards({ cards }: { cards: CardRow[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => {
        const th = resolveLoyaltyTheme(c.theme);
        const col = loyaltyColors(th);
        const Icon = STAMP_ICON[th.icon];
        const logo = th.showLogo ? th.logoUrl || c.photoUrl || null : null;
        const shown = Math.min(c.stamps, c.goal);
        return (
          <li key={c.token}>
            <Link href={`/fidelite/${c.token}`} className="block rounded-2xl p-4 transition-opacity duration-150 hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" style={{ background: col.card, color: col.text }}>
              <span className="flex items-center gap-3">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" className="size-9 shrink-0 rounded-lg bg-white object-cover" />
                ) : null}
                <span className="min-w-0 flex-1 truncate font-semibold">{th.name || c.business}</span>
                <Icon className="size-5 shrink-0" aria-hidden="true" />
              </span>
              <span className="mt-3 block text-2xl font-semibold tabular-nums">{shown}<span className="text-base"> / {c.goal} tampons</span></span>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${col.text} 25%, transparent)` }} aria-hidden="true"><span className="block h-full rounded-full" style={{ width: `${(shown / c.goal) * 100}%`, background: col.text }} /></span>
              <span className="mt-2 flex items-center gap-1.5 truncate text-sm">{c.stamps >= c.goal ? <><Gift className="size-4 shrink-0" aria-hidden="true" />Récompense débloquée : {c.reward}</> : `Au bout : ${c.reward}`}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

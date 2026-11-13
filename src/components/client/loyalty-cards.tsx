import Link from "next/link";
import { Gift } from "lucide-react";

type CardRow = { token: string; stamps: number; business: string; goal: number; reward: string };

/** Cartes de fidélité du client (espace client) : tampons, objectif, récompense. */
export function LoyaltyCards({ cards }: { cards: CardRow[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {cards.map((c) => (
        <li key={c.token}>
          <Link href={`/fidelite/${c.token}`} className="block rounded-2xl bg-accent p-4 text-accent-foreground transition-opacity duration-150 hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span className="flex items-center justify-between gap-3"><span className="truncate font-semibold">{c.business}</span><Gift className="size-5 shrink-0" aria-hidden="true" /></span>
            <span className="mt-3 block text-2xl font-semibold tabular-nums">{Math.min(c.stamps, c.goal)}<span className="text-base opacity-80"> / {c.goal} tampons</span></span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/25" aria-hidden="true"><span className="block h-full rounded-full bg-white" style={{ width: `${(Math.min(c.stamps, c.goal) / c.goal) * 100}%` }} /></span>
            <span className="mt-2 block truncate text-sm opacity-90">{c.stamps >= c.goal ? `Récompense débloquée : ${c.reward}` : `Au bout : ${c.reward}`}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

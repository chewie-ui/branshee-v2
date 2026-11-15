import { Check, Coffee, Dumbbell, Gift, Heart, PawPrint, Pizza, Sandwich, Scissors, Sparkles, Star, type LucideIcon } from "lucide-react";
import { loyaltyColors, type LoyaltyTheme, type StampIcon } from "@/lib/loyalty-theme";

export const STAMP_ICON: Record<StampIcon, LucideIcon> = { star: Star, heart: Heart, coffee: Coffee, sandwich: Sandwich, pizza: Pizza, scissors: Scissors, sparkles: Sparkles, dumbbell: Dumbbell, paw: PawPrint, check: Check };
const RADIUS = { md: "rounded-xl", lg: "rounded-2xl", xl: "rounded-3xl" } as const;

/**
 * La carte de fidélité elle-même (page du client et aperçu dans l'app) : à l'image de l'entreprise
 * (couleurs, police, logo, nom, icône des tampons), textes toujours lisibles.
 */
export function LoyaltyCardView({ theme, business, businessLogo, holder, stamps, goal, title, footer, earned, stampsLabel }: {
  theme: LoyaltyTheme;
  business: string;
  businessLogo: string | null;
  holder?: string | null;
  stamps: number;
  goal: number;
  title: string;
  footer: React.ReactNode;
  earned?: string | null;
  stampsLabel: string;
}) {
  const c = loyaltyColors(theme);
  const Icon = STAMP_ICON[theme.icon];
  const shown = Math.min(stamps, goal);
  const logo = theme.showLogo ? theme.logoUrl || businessLogo : null;
  const name = theme.name || business;
  return (
    <div
      className={`relative overflow-hidden p-6 shadow-lg ${RADIUS[theme.radius]}`}
      style={{ background: c.card, color: c.text, fontFamily: theme.font === "Inter" ? undefined : `"${theme.font}", system-ui, sans-serif` }}
    >
      {theme.bgImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={theme.bgImage} alt="" className="absolute inset-0 size-full object-cover" />
          <span className="absolute inset-0" style={{ background: c.card, opacity: 0.78 }} aria-hidden="true" />
        </>
      ) : null}
      <div className="relative">
        {logo || theme.showName ? (
          <div className="flex items-center gap-3">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="size-12 shrink-0 rounded-xl bg-white object-cover ring-2" style={{ ["--tw-ring-color" as string]: c.ring }} />
            ) : null}
            {theme.showName ? <p className="min-w-0 truncate text-base font-semibold">{name}</p> : null}
          </div>
        ) : null}
        <h1 className="mt-4 text-2xl font-semibold">{theme.title || title}</h1>
        {holder ? <p className="mt-0.5">{holder}</p> : null}
        <p className="mt-5 text-4xl font-semibold tabular-nums">{shown}<span className="text-xl"> / {goal}</span></p>
        <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${c.text} 25%, transparent)` }} aria-hidden="true">
          <div className="h-full rounded-full" style={{ width: `${(shown / goal) * 100}%`, background: c.text }} />
        </div>
        <ul className="mt-5 grid grid-cols-5 gap-3" aria-label={stampsLabel}>
          {Array.from({ length: goal }, (_, i) => {
            const on = i < stamps;
            return (
              <li key={i} className="flex aspect-square items-center justify-center rounded-full border-2" style={{ borderColor: `color-mix(in srgb, ${c.text} 70%, transparent)`, background: on ? c.stampOn : undefined, color: on ? c.stampIcon : c.text }}>
                {on ? <Icon className="size-5" fill={theme.icon === "star" || theme.icon === "heart" ? "currentColor" : "none"} aria-hidden="true" /> : i === goal - 1 ? <Gift className="size-4 opacity-80" aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ul>
        <div className="mt-6 rounded-xl px-4 py-3 text-sm" style={{ background: `color-mix(in srgb, ${c.text} 15%, transparent)` }}>{footer}</div>
        {earned ? <p className="mt-3 text-xs">{earned}</p> : null}
      </div>
    </div>
  );
}

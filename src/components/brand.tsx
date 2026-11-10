import type { BrandId } from "@/lib/brand";
import { BRANDS } from "@/lib/brand";

/** Symbole Skydev : un S au trait arrondi, un point de départ et une étoile (même dessin que l'icône de l'onglet). */
export function SkydevSymbol({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#4f46e5" />
      <path d="M28.5 13.5H18.5Q15 13.5 15 17V20Q15 23.5 18.5 23.5H29.5Q33 23.5 33 27V30.5Q33 34 29.5 34H18" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15.5" cy="34" r="2.6" fill="#fff" />
      <path d="M33.5 7.5L35 12L39.5 13.5L35 15L33.5 19.5L32 15L27.5 13.5L32 12Z" fill="#fff" />
    </svg>
  );
}

export function BrandMark({ className = "size-8", brand = "branshee" }: { className?: string; brand?: BrandId }) {
  if (brand === "skydev") return <SkydevSymbol className={`inline-block shrink-0 ${className}`} />;
  return (
    <span className={`inline-flex items-center justify-center rounded-lg bg-accent text-accent-foreground ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" className="size-[60%]">
        <path d="M7 4h6.5a3.5 3.5 0 0 1 0 7H7V4Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M7 11h7.5a4.5 4.5 0 0 1 0 9H7v-9Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Brand({ brand = "branshee", small = false }: { brand?: BrandId; small?: boolean }) {
  // Skydev : le nom s'écrit toujours « skydev », en minuscules, en Sora.
  if (brand === "skydev")
    return (
      <span className="inline-flex items-center gap-2.5">
        <BrandMark brand="skydev" className={small ? "size-7" : "size-8"} />
        <span className={small ? "text-[17px] font-bold tracking-[-0.04em]" : "text-xl font-bold tracking-[-0.04em]"} style={{ fontFamily: '"Sora", var(--font-sans)' }}>skydev</span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark brand={brand} className={small ? "size-7" : "size-8"} />
      <span className={small ? "text-base font-semibold tracking-tight" : "text-lg font-semibold tracking-tight"}>{BRANDS[brand].name}</span>
    </span>
  );
}

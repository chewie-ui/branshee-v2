import type { BrandId } from "@/lib/brand";
import { BRANDS } from "@/lib/brand";

/** Symbole Skydev « constellation de nuit » : un S d'étoiles reliées, ciel de nuit (version lisible en petit). */
export function SkydevSymbol({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#1e1b4b" />
      <polyline points="33,13 16,14 15,23 33,25 32,35 15,36" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="15" cy="36" r="3" fill="#a5b4fc" />
      <path d="M33 5.5L34.8 11.2L40.5 13L34.8 14.8L33 20.5L31.2 14.8L25.5 13L31.2 11.2Z" fill="#fff" />
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

import type { BrandId } from "@/lib/brand";
import { BRANDS } from "@/lib/brand";

export function BrandMark({ className = "size-8", brand = "branshee" }: { className?: string; brand?: BrandId }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-lg bg-accent text-accent-foreground ${className}`} aria-hidden="true">
      {brand === "skydev" ? (
        <svg viewBox="0 0 24 24" fill="none" className="size-[62%]">
          <path d="M17 6.5C16 5 14.3 4 12 4 9 4 7 5.6 7 7.8c0 4.9 10 2.9 10 8.2C17 18.4 14.8 20 12 20c-2.4 0-4.3-1-5.3-2.7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="size-[60%]">
          <path d="M7 4h6.5a3.5 3.5 0 0 1 0 7H7V4Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M7 11h7.5a4.5 4.5 0 0 1 0 9H7v-9Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

export function Brand({ brand = "branshee", small = false }: { brand?: BrandId; small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark brand={brand} className={small ? "size-7" : "size-8"} />
      <span className={small ? "text-base font-semibold tracking-tight" : "text-lg font-semibold tracking-tight"}>{BRANDS[brand].name}</span>
    </span>
  );
}

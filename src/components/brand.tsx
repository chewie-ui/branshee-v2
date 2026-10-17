export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-lg bg-accent text-accent-foreground ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" className="size-[60%]">
        <path d="M7 4h6.5a3.5 3.5 0 0 1 0 7H7V4Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M7 11h7.5a4.5 4.5 0 0 1 0 9H7v-9Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark />
      <span className="text-lg font-semibold tracking-tight">Branshee</span>
    </span>
  );
}

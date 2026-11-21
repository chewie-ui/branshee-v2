/**
 * Squelette affiché instantanément au clic sur une app ou une page, le temps que le serveur prépare le contenu :
 * la page change tout de suite au lieu de rester figée.
 */
const bar = "rounded-lg bg-surface-muted motion-safe:animate-pulse";

export function PageSkeleton({ label = "Chargement…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
      <span className="sr-only">{label}</span>
      <div className="space-y-2">
        <div className={`${bar} h-8 w-56`} />
        <div className={`${bar} h-4 w-80 max-w-full`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-surface p-5">
            <div className={`${bar} h-4 w-24`} />
            <div className={`${bar} h-7 w-32`} />
          </div>
        ))}
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`${bar} size-9 shrink-0 rounded-full`} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`${bar} h-4 w-2/5`} />
              <div className={`${bar} h-3 w-3/5`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

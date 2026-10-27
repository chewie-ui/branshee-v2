"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Feuille A4 (794 × 1123) réduite à la largeur disponible : aperçu dans l'éditeur et la fiche. */
export function A4Frame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / 794));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="rounded-xl border border-border bg-surface-muted p-3 sm:p-4">
      <div ref={ref} className="w-full overflow-hidden" style={{ height: 1123 * scale }}>
        <div className="origin-top-left shadow-md" style={{ width: 794, transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

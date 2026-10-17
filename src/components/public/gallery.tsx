"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Galerie publique avec visionneuse plein écran (flèches clavier, Échap pour fermer). */
export function Gallery({ images, layout, name }: { images: string[]; layout: "grid" | "mosaic" | "carousel"; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const go = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + images.length) % images.length)), [images.length]);
  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, go]);

  const thumb = (src: string, i: number, cls: string) => (
    <button type="button" onClick={() => setOpen(i)} className="block h-full w-full overflow-hidden rounded-lg focus-visible:outline-2" aria-label={`Agrandir la photo ${i + 1}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${name} — photo ${i + 1}`} className={cn("h-full w-full object-cover transition-transform hover:scale-105", cls)} loading="lazy" />
    </button>
  );

  return (
    <>
      {layout === "carousel" ? (
        <ul className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
          {images.map((src, i) => <li key={src} className="w-4/5 shrink-0 snap-center">{thumb(src, i, "aspect-[4/3]")}</li>)}
        </ul>
      ) : (
        <ul className={cn("grid gap-2", layout === "mosaic" ? "grid-cols-3 [&>li:first-child]:col-span-2 [&>li:first-child]:row-span-2" : "grid-cols-2")}>
          {images.map((src, i) => <li key={src}>{thumb(src, i, "aspect-square")}</li>)}
        </ul>
      )}
      {open != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Visionneuse" onClick={close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[open]} alt={`${name} — photo ${open + 1}`} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={close} className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Fermer"><X className="size-5" aria-hidden="true" /></button>
          {images.length > 1 ? (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Photo précédente"><ChevronLeft className="size-6" aria-hidden="true" /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Photo suivante"><ChevronRight className="size-6" aria-hidden="true" /></button>
              <p className="absolute bottom-4 text-sm text-white/80">{open + 1} / {images.length}</p>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

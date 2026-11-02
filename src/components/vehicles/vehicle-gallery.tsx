"use client";

import { useState } from "react";
import { CarFront, ChevronLeft, ChevronRight } from "lucide-react";

/** Galerie de la fiche publique : grande photo, flèches (et clavier), vignettes. */
export function VehicleGallery({ photos, title }: { photos: string[]; title: string }) {
  const [i, setI] = useState(0);
  if (!photos.length)
    return <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-surface-muted text-muted"><CarFront className="size-12" aria-hidden="true" /></div>;
  const go = (d: number) => setI((x) => (x + d + photos.length) % photos.length);
  return (
    <div>
      <div
        className="relative overflow-hidden rounded-2xl bg-surface-muted"
        tabIndex={0}
        role="group"
        aria-roledescription="galerie"
        aria-label={`Photos de ${title}`}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- photos téléversées (/media) */}
        <img src={photos[i]} alt={`${title}, photo ${i + 1} sur ${photos.length}`} className="aspect-[4/3] w-full object-cover" />
        {photos.length > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute top-1/2 left-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow hover:bg-white" aria-label="Photo précédente"><ChevronLeft className="size-5" aria-hidden="true" /></button>
            <button type="button" onClick={() => go(1)} className="absolute top-1/2 right-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow hover:bg-white" aria-label="Photo suivante"><ChevronRight className="size-5" aria-hidden="true" /></button>
            <span className="absolute right-3 bottom-3 rounded-md bg-black/70 px-2 py-0.5 text-xs font-medium text-white" aria-hidden="true">{i + 1} / {photos.length}</span>
          </>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, k) => (
            <li key={p} className="shrink-0">
              <button type="button" onClick={() => setI(k)} aria-label={`Afficher la photo ${k + 1}`} aria-current={k === i ? "true" : undefined} className={`block overflow-hidden rounded-lg border-2 ${k === i ? "border-accent" : "border-transparent opacity-80 hover:opacity-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- vignette */}
                <img src={p} alt="" className="h-16 w-24 object-cover" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Gift, Shrink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentLoyaltyQr } from "@/server/actions/loyalty";

/** Écran du pro : QR code renouvelé toutes les 30 secondes (une photo du code ne sert pas plus tard). */
export function LoyaltyQrScreen({ business, goal, reward }: { business: string; goal: number; reward: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const load = async () => {
      const r = await currentLoyaltyQr().catch(() => ({ ok: false as const, error: "Connexion perdue, nouvel essai…" }));
      if (!alive) return;
      if (r.ok) { setSvg(r.svg); setError(null); timer = setTimeout(load, Math.max(2000, r.expiresIn + 300)); }
      else { setError(r.error); timer = setTimeout(load, 5000); }
    };
    load();
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => { alive = false; clearTimeout(timer); document.removeEventListener("fullscreenchange", onFs); };
  }, []);

  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await box.current?.requestFullscreen();
    } catch {
      /* plein écran indisponible (iPhone) : la page reste lisible */
    }
  };

  return (
    <div ref={box} className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-border bg-surface p-6 text-center sm:p-8 [&:fullscreen]:max-w-none [&:fullscreen]:justify-center [&:fullscreen]:rounded-none [&:fullscreen]:border-0">
      <p className="text-sm font-medium text-muted">{business}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Scannez pour votre tampon</h2>
      <div className="mt-5 w-full max-w-xs rounded-xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" aria-label="QR code à scanner pour recevoir un tampon de fidélité" role="img">
        {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="aspect-square w-full animate-pulse rounded-lg bg-surface-muted" />}
      </div>
      {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
      <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-sm font-medium text-accent-soft-foreground"><Gift className="size-4" aria-hidden="true" />{goal} tampons = {reward}</p>
      <p className="mt-3 text-xs text-muted">Ouvrez l&apos;appareil photo et visez le code. Il change toutes les 30 secondes.</p>
      <Button variant="secondary" size="sm" className="mt-5" onClick={toggle} icon={full ? <Shrink className="size-4" aria-hidden="true" /> : <Expand className="size-4" aria-hidden="true" />}>{full ? "Quitter le plein écran" : "Plein écran"}</Button>
    </div>
  );
}

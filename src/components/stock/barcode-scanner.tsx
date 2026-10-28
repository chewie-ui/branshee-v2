"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

/** Le navigateur sait-il lire les codes-barres avec la caméra (Chrome Android, Edge…) ? */
export const canScan = () => typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

/** Lecture d'un code-barres avec la caméra du téléphone. Un lecteur USB marche aussi : il « tape » le code dans le champ de recherche. */
export function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
        const det = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current || stop) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stop || !video.current) return;
          try {
            const found = await det.detect(video.current);
            if (found[0]?.rawValue) { onCode(found[0].rawValue); return; }
          } catch {}
          setTimeout(tick, 250);
        };
        tick();
      } catch {
        setError("Caméra indisponible. Autorisez la caméra, ou tapez le code à la main.");
      }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Scanner un code-barres">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-black">
        <video ref={video} className="aspect-[3/4] w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/80" aria-hidden="true" />
        <button type="button" onClick={onClose} className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-black/60 text-white" aria-label="Fermer"><X className="size-5" aria-hidden="true" /></button>
        <p className="absolute inset-x-0 bottom-0 bg-black/60 p-3 text-center text-sm text-white" role="status">{error ?? "Visez le code-barres"}</p>
      </div>
    </div>
  );
}

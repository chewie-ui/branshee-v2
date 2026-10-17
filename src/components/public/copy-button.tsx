"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Petit bouton « copier » à côté d'un email ou d'un numéro. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* presse-papiers indisponible */
        }
      }}
      className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-text"
      aria-label={done ? "Copié" : `Copier ${label}`}
      title={done ? "Copié" : `Copier ${label}`}
    >
      {done ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
    </button>
  );
}

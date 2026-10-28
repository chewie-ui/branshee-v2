"use client";

import { Printer } from "lucide-react";

/** Bouton « Imprimer / PDF » (masqué à l'impression). */
export function PrintButton({ label = "Imprimer / PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 font-medium hover:bg-surface-muted print:hidden">
      <Printer className="size-4" aria-hidden="true" />{label}
    </button>
  );
}

"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Barre au-dessus de la feuille (masquée à l'impression) ; la fenêtre d'impression s'ouvre toute seule. */
export function PrintToolbar() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="mx-auto mb-4 flex w-[794px] max-w-full items-center justify-between gap-3 px-4 print:hidden">
      <p className="text-sm text-muted">Choisissez « Enregistrer au format PDF » comme imprimante pour obtenir le fichier.</p>
      <Button icon={<Printer className="size-4" aria-hidden="true" />} onClick={() => window.print()}>Imprimer / PDF</Button>
    </div>
  );
}

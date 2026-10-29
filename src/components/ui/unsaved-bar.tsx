"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Barre « modifications non enregistrées » collée en bas de l'écran dès qu'un formulaire change, où que l'on
 * soit dans la page. Quitter la page (fermer l'onglet, recharger, cliquer un lien) demande confirmation.
 */
export function UnsavedBar({ dirty, pending, onSave, onReset, label = "Enregistrer" }: { dirty: boolean; pending?: boolean; onSave: () => void; onReset?: () => void; label?: string }) {
  useLeaveGuard(dirty);
  if (!dirty) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 sm:p-4 lg:pl-64">
      <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-lg" role="region" aria-label="Modifications non enregistrées">
        <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm font-medium">Modifications non enregistrées</p>
        {onReset ? <Button variant="ghost" size="sm" disabled={pending} onClick={onReset}>Annuler</Button> : null}
        <Button size="sm" loading={pending} onClick={onSave}>{label}</Button>
      </div>
    </div>
  );
}

/** Quitter la page avec des changements non enregistrés : confirmation (onglet, rechargement, liens). */
export function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    // Liens internes (navigation de l'app) : confirmation avant de perdre les changements.
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (!window.confirm("Vos modifications ne sont pas enregistrées. Quitter quand même ?")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", before); document.removeEventListener("click", click, true); };
  }, [dirty]);
}

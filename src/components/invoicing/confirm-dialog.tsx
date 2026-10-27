"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Fenêtre de confirmation (sans boîte de dialogue du navigateur), fermée par Échap ou « Annuler ». */
export function ConfirmDialog({ open, title, children, confirmLabel, danger = false, loading, onConfirm, onCancel }: { open: boolean; title: string; children: ReactNode; confirmLabel: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onCancel} />
      <div ref={ref} className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 id="confirm-title" className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-muted">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Annuler</Button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm} data-autofocus>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

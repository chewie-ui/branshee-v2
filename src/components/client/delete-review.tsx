"use client";

import { useState, useTransition } from "react";
import { deleteMyReview } from "@/server/actions/reviews";

export function DeleteReviewButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm) return <button type="button" onClick={() => setConfirm(true)} className="text-xs font-medium text-muted hover:text-danger">Supprimer</button>;
  return (
    <span className="flex items-center gap-2 text-xs">
      <button type="button" disabled={pending} onClick={() => start(async () => void (await deleteMyReview(id)))} className="font-medium text-danger">Confirmer</button>
      <button type="button" onClick={() => setConfirm(false)} className="text-muted">Annuler</button>
    </span>
  );
}

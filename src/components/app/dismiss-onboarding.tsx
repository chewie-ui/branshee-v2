"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { dismissOnboarding } from "@/server/actions/business";

export function DismissOnboarding() {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => void (await dismissOnboarding()))} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label="Masquer la checklist">
      <X className="size-4" aria-hidden="true" />
    </button>
  );
}

"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { dismissOnboarding } from "@/server/actions/business";
import { useT } from "@/components/app-locale";

export function DismissOnboarding() {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => void (await dismissOnboarding()))} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label={t("Masquer la checklist")}>
      <X className="size-4" aria-hidden="true" />
    </button>
  );
}

"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/i18n/client";

/** Petit bouton « copier » à côté d'un email ou d'un numéro. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useI18n();
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
      aria-label={done ? t("common.copied") : t("common.copy", { label })}
      title={done ? t("common.copied") : t("common.copy", { label })}
    >
      {done ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
    </button>
  );
}

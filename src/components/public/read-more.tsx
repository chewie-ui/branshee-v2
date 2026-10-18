"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";

/** Texte long replié (« Voir plus ») — le contenu complet reste dans la page pour le référencement. */
export function ReadMore({ children, long }: { children: ReactNode; long: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!long) return <>{children}</>;
  return (
    <div>
      <div className={open ? "" : "relative max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]"}>{children}</div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-2 text-sm font-medium text-accent hover:text-accent-hover">
        {open ? t("common.seeLess") : t("common.seeMore")}
      </button>
    </div>
  );
}

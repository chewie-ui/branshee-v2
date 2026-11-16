"use client";

import { useState, useTransition } from "react";
import { Star, X } from "lucide-react";
import { answerReviewAsk } from "@/server/actions/review-ask";
import { useT } from "@/components/app-locale";

/** Carte de l'accueil pro : demander un avis Google sur Skydev (une fois, « plus tard » = dans 30 jours). */
export function ReviewAsk({ href }: { href: string }) {
  const t = useT();
  const [hidden, setHidden] = useState(false);
  const [, start] = useTransition();
  if (hidden) return null;
  const answer = (a: "done" | "later") => { setHidden(true); start(() => answerReviewAsk(a)); };
  return (
    <section aria-label={t("Votre avis sur Skydev")} className="relative mx-auto mb-8 flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning"><Star className="size-5" fill="currentColor" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1 pr-8 sm:pr-0">
        <span className="block text-sm font-semibold sm:text-base">{t("Skydev vous aide au quotidien ?")}</span>
        <span className="block text-sm text-muted">{t("Un petit avis Google nous aide énormément à nous faire connaître. Ça prend 30 secondes.")}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => answer("done")} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{t("Laisser un avis")}</a>
        <button type="button" onClick={() => answer("later")} className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{t("Plus tard")}</button>
      </span>
      <button type="button" onClick={() => answer("later")} aria-label={t("Fermer")} className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted sm:hidden"><X className="size-4" aria-hidden="true" /></button>
    </section>
  );
}

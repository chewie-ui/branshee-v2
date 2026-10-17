"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { setScheduleMode } from "@/server/actions/schedule";

const OPTIONS = [
  { value: "shared", title: "Les mêmes pour tout le monde", description: "Une seule grille d'horaires pour l'établissement." },
  { value: "per_member", title: "Différents pour chaque membre", description: "Chacun a sa propre grille, idéal à plusieurs praticiens." },
] as const;

export function ScheduleMode({ value, canEdit }: { value: "shared" | "per_member"; canEdit: boolean }) {
  const [pending, start] = useTransition();
  return (
    <fieldset disabled={!canEdit || pending}>
      <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
        Horaires de l&apos;équipe
        {pending ? <Loader2 className="size-4 animate-spin text-muted" aria-label="Enregistrement" /> : null}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer gap-3 rounded-xl border bg-surface p-4 transition-colors has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
              value === o.value ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong",
            )}
          >
            <input type="radio" name="scheduleMode" value={o.value} checked={value === o.value} onChange={() => start(async () => void (await setScheduleMode(o.value)))} className="mt-0.5 size-4 accent-[var(--accent)]" />
            <span>
              <span className="block text-sm font-semibold">{o.title}</span>
              <span className="mt-0.5 block text-sm text-muted">{o.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

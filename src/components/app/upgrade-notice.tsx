import { Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { planLabel, type Plan } from "@/lib/plans";

/** Encart « disponible avec le forfait X » — jamais bloquant pour ce qui existe déjà. */
export function UpgradeNotice({ feature, required, children }: { feature: string; required: Plan; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent-soft p-4 sm:flex-row sm:items-center">
      <Sparkles className="size-5 shrink-0 text-accent" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-accent-soft-foreground">{feature} : forfait {planLabel(required)}</p>
        <p className="text-muted">{children ?? "Passez au forfait supérieur pour en profiter."}</p>
      </div>
      <ButtonLink href="/app/reglages/abonnement" size="sm">Voir les forfaits</ButtonLink>
    </div>
  );
}

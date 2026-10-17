import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Section pas encore reconstruite dans la v2 : on affiche ce qu'elle contiendra
 * (repris de docs/UI-ARCHITECTURE.md) plutôt qu'une page vide.
 */
export function UpcomingSection({ title, description, icon, features }: { title: string; description: string; icon: ReactNode; features: string[] }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent [&_svg]:size-5" aria-hidden="true">
            {icon}
          </div>
          <div>
            <p className="font-semibold">En cours de reconstruction</p>
            <p className="mt-1 text-sm text-muted">Cette section arrive dans une prochaine étape de la v2. Elle regroupera :</p>
            <ul className="mt-4 space-y-2 text-sm">
              {features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </>
  );
}

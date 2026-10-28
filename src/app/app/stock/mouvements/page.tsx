import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { MOVE_REASONS } from "@/lib/stock";
import { requireContext } from "@/server/context";
import { movesOf } from "@/server/stock";

export const metadata: Metadata = { title: "Mouvements de stock" };

/** Historique des entrées et sorties : qui, quoi, quand. */
export default async function MovesPage() {
  const ctx = await requireContext();
  const moves = await movesOf(ctx.business.id);
  const fmt = new Intl.DateTimeFormat("fr-BE", { timeZone: ctx.business.timezone || "Europe/Brussels", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <>
      <PageHeader title="Mouvements" description="Les 500 derniers mouvements de stock." />
      {moves.length === 0 ? <Card className="p-8 text-center text-sm text-muted">Aucun mouvement pour l&apos;instant.</Card> : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {moves.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                <span className="w-28 shrink-0 text-muted">{fmt.format(m.createdAt)}</span>
                <span className="min-w-0 flex-1 truncate"><span className="font-medium">{m.product}</span><span className="text-muted"> · {MOVE_REASONS[m.reason as keyof typeof MOVE_REASONS] ?? m.reason}{m.note ? ` · ${m.note}` : ""}{m.by ? ` · ${m.by}` : ""}</span></span>
                <span className={cn("w-16 text-right font-semibold tabular-nums", m.delta > 0 ? "text-success" : "text-danger")}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

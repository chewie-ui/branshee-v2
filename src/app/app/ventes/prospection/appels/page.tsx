import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CallSession } from "@/components/prospects/call-session";
import { requireContext } from "@/server/context";
import { callQueueOf, prospectHistory, prospectScript, prospectStats } from "@/server/prospects";
import { salesRights } from "@/server/sales";

export const metadata: Metadata = { title: "Session d'appels" };
export const dynamic = "force-dynamic";

/** Session d'appels : un prospect à la fois, le script à côté, le résultat en un clic. */
export default async function CallSessionPage({ searchParams }: { searchParams: Promise<{ passer?: string }> }) {
  const ctx = await requireContext(undefined, { app: "ventes" });
  if (!salesRights(ctx).manage) redirect("/app/ventes/prospection");
  // Prospects passés pendant cette session (sans résultat) : en fin de file.
  const skipped = ((await searchParams).passer ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 200);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [queue, script, today] = await Promise.all([callQueueOf(ctx.business.id), prospectScript(ctx.business.id), prospectStats(ctx.business.id, startOfDay)]);
  const ordered = [...queue.filter((p) => !skipped.includes(p.id)), ...queue.filter((p) => skipped.includes(p.id))];
  const current = ordered[0] ?? null;
  const history = current ? await prospectHistory(ctx.business.id, current.id) : [];
  return (
    <CallSession
      current={current}
      remaining={ordered.length}
      skipped={skipped}
      script={script}
      today={{ calls: today.total, answered: today.answered, interested: today.interested }}
      history={history.map((h) => ({ id: h.id, outcome: h.outcome, note: h.note, at: h.at.toISOString(), who: h.who }))}
      timezone={ctx.business.timezone || "Europe/Brussels"}
    />
  );
}

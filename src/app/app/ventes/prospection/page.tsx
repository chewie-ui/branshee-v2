import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Phone, Upload } from "lucide-react";
import { ProspectBoard } from "@/components/prospects/prospect-board";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { PROSPECT_STATUS } from "@/lib/prospects";
import { requireContext } from "@/server/context";
import { callQueueOf, listProspects, prospectCounts, prospectStats, upcomingCallbacks } from "@/server/prospects";
import { salesRights } from "@/server/sales";

export const metadata: Metadata = { title: "Prospection" };
export const dynamic = "force-dynamic";

type SP = Promise<{ statut?: string; q?: string }>;

/** Prospection : la liste des gens à démarcher, les résultats et le bouton pour lancer une session d'appels. */
export default async function ProspectionPage({ searchParams }: { searchParams: SP }) {
  const ctx = await requireContext(undefined, { app: "ventes" });
  const rights = salesRights(ctx);
  if (!rights.view) redirect("/app/acces-refuse");
  const sp = await searchParams;
  const status = sp.statut ?? "";
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const week = new Date(startOfDay);
  week.setDate(week.getDate() - 6);
  const [rows, counts, queue, today, last7, callbacks] = await Promise.all([
    listProspects(ctx.business.id, { status, q }),
    prospectCounts(ctx.business.id),
    callQueueOf(ctx.business.id),
    prospectStats(ctx.business.id, startOfDay),
    prospectStats(ctx.business.id, week),
    upcomingCallbacks(ctx.business.id),
  ]);
  const tabs: { id: string; label: string; n: number }[] = [
    { id: "", label: "Tous", n: counts.total ?? 0 },
    ...(Object.keys(PROSPECT_STATUS) as (keyof typeof PROSPECT_STATUS)[]).map((k) => ({ id: k, label: PROSPECT_STATUS[k].label, n: counts[k] ?? 0 })),
    { id: "unreachable", label: "Injoignables", n: counts.unreachable ?? 0 },
  ].filter((t) => t.id === "" || t.n > 0);
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(status ? { statut: status } : {}), ...(q ? { q } : {}), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `/app/ventes/prospection?${s}` : "/app/ventes/prospection";
  };
  const fmt = new Intl.DateTimeFormat("fr-BE", { timeZone: ctx.business.timezone || "Europe/Brussels", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <PageHeader
        title="Prospection"
        description="Votre liste de personnes à démarcher : appelez, notez le résultat en un clic, et les intéressés deviennent des pistes."
        action={
          rights.manage ? (
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/app/ventes/prospection/importer" variant="secondary" icon={<Upload className="size-4" aria-hidden="true" />}>Importer une liste</ButtonLink>
              {queue.length ? <ButtonLink href="/app/ventes/prospection/appels" icon={<Phone className="size-4" aria-hidden="true" />}>Lancer les appels ({queue.length})</ButtonLink> : null}
            </div>
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4"><p className="text-sm text-muted">Appels aujourd&apos;hui</p><p className="mt-1 text-2xl font-semibold tabular-nums">{today.total}</p><p className="text-xs text-muted">{today.answered} joint{today.answered > 1 ? "s" : ""}, {today.interested} intéressé{today.interested > 1 ? "s" : ""}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Taux de réponse (7 j)</p><p className="mt-1 text-2xl font-semibold tabular-nums">{last7.reachRate} %</p><p className="text-xs text-muted">{last7.total} appel{last7.total > 1 ? "s" : ""} sur 7 jours</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Intéressés (7 j)</p><p className="mt-1 text-2xl font-semibold tabular-nums">{last7.interestRate} %</p><p className="text-xs text-muted">des personnes jointes</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">À appeler maintenant</p><p className="mt-1 text-2xl font-semibold tabular-nums">{queue.length}</p><p className="text-xs text-muted">{counts.total ?? 0} prospect{(counts.total ?? 0) > 1 ? "s" : ""} au total</p></Card>
      </div>

      {last7.reasons.length || callbacks.length ? (
        <div className="mb-6 grid gap-3 lg:grid-cols-2">
          {callbacks.length ? (
            <Card className="p-4">
              <p className="text-sm font-medium">Rappels prévus</p>
              <ul className="mt-2 space-y-1 text-sm">
                {callbacks.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex justify-between gap-3"><span className="truncate">{c.company || c.name}</span><span className="shrink-0 text-muted tabular-nums">{fmt.format(new Date(c.callbackAt!))}</span></li>
                ))}
              </ul>
            </Card>
          ) : null}
          {last7.reasons.length ? (
            <Card className="p-4">
              <p className="text-sm font-medium">Raisons de refus</p>
              <ul className="mt-2 space-y-1 text-sm">
                {last7.reasons.map(([r, n]) => (
                  <li key={r} className="flex justify-between gap-3"><span className="truncate">{r}</span><span className="shrink-0 text-muted tabular-nums">{n}</span></li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <Link key={t.id || "all"} href={href({ statut: t.id })} aria-current={status === t.id ? "page" : undefined} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors duration-150", status === t.id ? "border-accent bg-accent-soft font-medium text-accent-soft-foreground" : "border-border text-muted hover:border-border-strong hover:text-text")}>
            {t.label}<span className="tabular-nums opacity-70">{t.n}</span>
          </Link>
        ))}
        <form action="/app/ventes/prospection" className="ml-auto w-full sm:w-64" role="search">
          {status ? <input type="hidden" name="statut" value={status} /> : null}
          <label className="sr-only" htmlFor="pq">Rechercher</label>
          <input id="pq" name="q" defaultValue={q} placeholder="Rechercher un nom, une ville…" className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30" />
        </form>
      </div>

      <ProspectBoard rows={rows} canManage={rights.manage} filtered={!!(status || q)} />
    </>
  );
}

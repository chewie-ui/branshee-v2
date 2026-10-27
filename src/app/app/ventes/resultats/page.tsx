import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { todayIn } from "@/lib/planning";
import { winRate } from "@/lib/sales";
import { requireContext } from "@/server/context";
import { listDeals, salesMembers, salesRights } from "@/server/sales";

export const metadata: Metadata = { title: "Résultats des ventes" };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(c / 100);
const monthLabel = (ym: string) => new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", month: "short" }).format(new Date(`${ym}-15T12:00:00Z`));

/** Ventes gagnées par mois, origine des clients, raisons des pertes, résultats par personne. */
export default async function SalesResultsPage() {
  const ctx = await requireContext();
  if (!salesRights(ctx).view) redirect("/app/acces-refuse");
  const today = todayIn(ctx.business.timezone || "Europe/Brussels");
  const [deals, team] = await Promise.all([listDeals(ctx.business.id), salesMembers(ctx.business.id)]);
  const months: string[] = [];
  const d0 = new Date(`${today.slice(0, 7)}-15T12:00:00Z`);
  for (let i = 5; i >= 0; i--) { const d = new Date(d0); d.setUTCMonth(d.getUTCMonth() - i); months.push(d.toISOString().slice(0, 7)); }
  const won = deals.filter((d) => d.stage === "won");
  const byMonth = months.map((m) => ({ m, v: won.filter((d) => d.closedAt?.slice(0, 7) === m).reduce((a, d) => a + d.valueCents, 0) }));
  const max = Math.max(1, ...byMonth.map((x) => x.v));
  const group = (rows: typeof deals, key: (d: (typeof deals)[number]) => string) => [...rows.reduce((m, d) => m.set(key(d), [...(m.get(key(d)) ?? []), d]), new Map<string, typeof deals>())].sort((a, b) => b[1].length - a[1].length);
  const sources = group(deals, (d) => d.source || "Non renseignée");
  const reasons = group(deals.filter((d) => d.stage === "lost"), (d) => d.lostReason || "Non renseignée");
  const avg = won.length ? Math.round(won.reduce((a, d) => a + d.valueCents, 0) / won.length) : 0;
  return (
    <>
      <PageHeader title="Résultats" description="Vos ventes des 12 derniers mois." />
      {deals.length === 0 ? <Card className="p-8 text-center text-muted">Les résultats apparaîtront dès vos premières pistes.</Card> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Gagné par mois" description={`Panier moyen : ${eur(avg)} · ${won.length} vente${won.length > 1 ? "s" : ""}`} />
            <div className="flex h-48 items-end gap-3 px-5 pb-5" role="img" aria-label={byMonth.map((x) => `${monthLabel(x.m)} : ${eur(x.v)}`).join(", ")}>
              {byMonth.map((x) => (
                <div key={x.m} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[11px] text-muted tabular-nums">{x.v ? eur(x.v) : ""}</span>
                  <div className="w-full max-w-10 rounded-t-md bg-accent" style={{ height: `${Math.max(x.v ? 4 : 1, (x.v / max) * 100)}%`, opacity: x.v ? 1 : 0.2 }} />
                  <span className="text-xs text-muted">{monthLabel(x.m)}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="D'où viennent vos clients" description="Pistes et taux de réussite par origine" />
            <table className="w-full text-sm">
              <thead className="sr-only"><tr><th>Origine</th><th>Pistes</th><th>Réussite</th></tr></thead>
              <tbody className="divide-y divide-border">
                {sources.map(([s, rows]) => { const r = winRate(rows); return <tr key={s}><td className="px-5 py-2">{s}</td><td className="px-2 py-2 text-right tabular-nums">{rows.length} piste{rows.length > 1 ? "s" : ""}</td><td className="px-5 py-2 text-right text-muted tabular-nums">{r === null ? "—" : `${r} %`}</td></tr>; })}
              </tbody>
            </table>
          </Card>
          {team.length > 1 ? (
            <Card>
              <CardHeader title="Par personne" />
              <table className="w-full text-sm">
                <thead className="sr-only"><tr><th>Personne</th><th>En cours</th><th>Gagné</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {team.map((m) => { const mine = deals.filter((d) => d.ownerMemberId === m.id); return <tr key={m.id}><td className="px-5 py-2">{m.name}</td><td className="px-2 py-2 text-right text-muted tabular-nums">{mine.filter((d) => d.stage !== "won" && d.stage !== "lost").length} en cours</td><td className="px-5 py-2 text-right tabular-nums">{eur(mine.filter((d) => d.stage === "won").reduce((a, d) => a + d.valueCents, 0))}</td></tr>; })}
                </tbody>
              </table>
            </Card>
          ) : null}
          {reasons.length ? (
            <Card>
              <CardHeader title="Pourquoi vous perdez" description="Pour ajuster vos prix ou votre suivi" />
              <ul className="divide-y divide-border text-sm">{reasons.map(([r, rows]) => <li key={r} className="flex justify-between px-5 py-2"><span>{r}</span><span className="tabular-nums">{rows.length}</span></li>)}</ul>
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Download, Info } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { FRANCHISE_THRESHOLD, GRID, parsePeriod, periodKey, periodRange, vatBalance, type Period } from "@/lib/accounting";
import { todayIn } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { accountingFor, monthlySeries, receivables } from "@/server/accounting";
import { getSellerSettings } from "@/server/invoicing";

export const metadata: Metadata = { title: "Comptabilité" };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);
const monthLabel = (ym: string) => new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", month: "short" }).format(new Date(`${ym}-15T12:00:00Z`));

/** Aide à la TVA, recettes et dépenses, factures à encaisser, trésorerie sur 12 mois. */
export default async function AccountingPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const ctx = await requireContext("invoices.view");
  const tz = ctx.business.timezone || "Europe/Brussels";
  const today = todayIn(tz);
  const period = parsePeriod((await searchParams).p, today);
  const range = periodRange(period);
  const seller = await getSellerSettings(ctx.business.id);
  const regime = seller.vatRegime;
  const year = Number(today.slice(0, 4));
  const [a, rec, series, ytd] = await Promise.all([accountingFor(ctx.business.id, range.from, range.to, regime, tz), receivables(ctx.business.id, today), monthlySeries(ctx.business.id, today, regime, tz), regime === "franchise" ? accountingFor(ctx.business.id, `${year}-01-01`, `${year}-12-31`, regime, tz) : Promise.resolve(null)]);
  const balance = vatBalance(a.vatDue, a.expenses.vat);
  const result = a.salesHt - a.expenses.ht;
  const max = Math.max(1, ...series.flatMap((s) => [s.income, s.expenses]));
  const q = Math.ceil(Number(today.slice(5, 7)) / 3);
  const choices: [string, Period][] = [
    [`T${q} ${year}`, { kind: "quarter", year, index: q }],
    ...(q > 1 ? [[`T${q - 1} ${year}`, { kind: "quarter", year, index: q - 1 }] as [string, Period]] : [[`T4 ${year - 1}`, { kind: "quarter", year: year - 1, index: 4 }] as [string, Period]]),
    [`Ce mois-ci`, { kind: "month", year, index: Number(today.slice(5, 7)) }],
    [String(year), { kind: "year", year, index: 1 }],
    [String(year - 1), { kind: "year", year: year - 1, index: 1 }],
  ];
  return (
    <>
      <PageHeader title="Comptabilité" description="Vos chiffres au même endroit : factures, caisse, boutique en ligne, dépenses, TVA et argent à encaisser. Les commandes à table comptent quand elles passent par la Caisse." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-lg bg-surface-muted p-1" role="group" aria-label="Période">
          {choices.map(([l, p]) => <Link key={l} href={`/app/compta?p=${periodKey(p)}`} aria-current={periodKey(p) === periodKey(period) ? "page" : undefined} className={cn("h-8 rounded-md px-3 text-sm leading-8 font-medium", periodKey(p) === periodKey(period) ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>{l}</Link>)}
        </div>
        <a href={`/app/compta/export?p=${periodKey(period)}`} download className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted"><Download className="size-4" aria-hidden="true" />Export pour le comptable</a>
      </div>
      <h2 className="mb-3 text-lg font-semibold first-letter:uppercase">{range.label}</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><p className="text-sm text-muted">Ventes HTVA</p><p className="mt-1 text-xl font-semibold tabular-nums">{eur(a.salesHt)}</p><p className="text-xs text-muted">{a.invoices.count} facture{a.invoices.count > 1 ? "s" : ""}{a.pos.count ? ` · ${a.pos.count} ticket${a.pos.count > 1 ? "s" : ""} de caisse` : ""}{a.pos.refunds ? ` (−${a.pos.refunds} remboursé${a.pos.refunds > 1 ? "s" : ""})` : ""}{a.shop.count ? ` · ${a.shop.count} commande${a.shop.count > 1 ? "s" : ""} en ligne` : ""}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Dépenses HTVA</p><p className="mt-1 text-xl font-semibold tabular-nums">{eur(a.expenses.ht)}</p><p className="text-xs text-muted">{a.expenses.count} dépense{a.expenses.count > 1 ? "s" : ""}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Résultat avant impôts</p><p className={cn("mt-1 text-xl font-semibold tabular-nums", result < 0 && "text-danger")}>{eur(result)}</p><p className="text-xs text-muted">Ventes − dépenses (hors amortissements)</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">À encaisser</p><p className="mt-1 text-xl font-semibold tabular-nums">{eur(rec.total)}</p><p className={cn("text-xs", rec.overdue ? "text-danger" : "text-muted")}>{rec.overdue ? `dont ${eur(rec.overdue)} en retard` : "Rien en retard"}</p></Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {regime === "assujetti" ? (
          <Card>
            <CardHeader title="Aide à la déclaration TVA" description="À recopier dans Intervat (vérifiez avec votre comptable)" />
            <table className="w-full text-sm">
              <thead><tr className="border-y border-border text-left text-xs text-muted"><th className="px-5 py-2">Grille</th><th className="px-2 py-2">Opérations</th><th className="px-5 py-2 text-right">Montant</th></tr></thead>
              <tbody className="divide-y divide-border">
                {a.sales.length === 0 ? <tr><td colSpan={3} className="px-5 py-4 text-muted">Aucune vente sur la période.</td></tr> : null}
                {a.sales.map((r) => <tr key={r.rate}><td className="px-5 py-2 font-mono">{GRID[r.rate] ?? "—"}</td><td className="px-2 py-2">Ventes à {r.rate} % (base HTVA)</td><td className="px-5 py-2 text-right tabular-nums">{eur(r.base)}</td></tr>)}
                {a.invoices.credits ? <tr><td className="px-5 py-2 font-mono">49</td><td className="px-2 py-2">Notes de crédit émises (déjà déduites ci-dessus)</td><td className="px-5 py-2 text-right tabular-nums">{eur(a.invoices.credits)}</td></tr> : null}
                <tr><td className="px-5 py-2 font-mono">54</td><td className="px-2 py-2">TVA due sur vos ventes</td><td className="px-5 py-2 text-right tabular-nums">{eur(a.vatDue)}</td></tr>
                <tr><td className="px-5 py-2 font-mono">59</td><td className="px-2 py-2">TVA déductible sur vos dépenses</td><td className="px-5 py-2 text-right tabular-nums">{eur(a.expenses.vat)}</td></tr>
                <tr className="font-semibold"><td className="px-5 py-2 font-mono">{balance >= 0 ? "71" : "72"}</td><td className="px-2 py-2">{balance >= 0 ? "TVA à payer" : "TVA à récupérer"}</td><td className="px-5 py-2 text-right tabular-nums">{eur(Math.abs(balance))}</td></tr>
              </tbody>
            </table>
            <p className="flex gap-2 px-5 py-3 text-xs text-muted"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Calcul à partir de vos factures émises, tickets de caisse et dépenses notées dans Skydev. Les achats de biens d&apos;investissement, intracommunautaires ou en autoliquidation ne sont pas couverts.</p>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Franchise de TVA" description="Vous ne facturez pas de TVA et ne faites pas de déclaration périodique." />
            <div className="space-y-2 p-5 text-sm">
              <p>Chiffre d&apos;affaires {year} : <b className="tabular-nums">{eur(ytd?.salesHt ?? 0)}</b> sur un plafond de {eur(FRANCHISE_THRESHOLD)}.</p>
              <div className="h-2 rounded-full bg-surface-muted" role="progressbar" aria-valuenow={Math.round(((ytd?.salesHt ?? 0) / FRANCHISE_THRESHOLD) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Plafond de la franchise"><div className={cn("h-full rounded-full", (ytd?.salesHt ?? 0) > FRANCHISE_THRESHOLD * 0.8 ? "bg-warning" : "bg-accent")} style={{ width: `${Math.min(100, ((ytd?.salesHt ?? 0) / FRANCHISE_THRESHOLD) * 100)}%` }} /></div>
              {(ytd?.salesHt ?? 0) > FRANCHISE_THRESHOLD * 0.8 ? <p className="flex gap-2 text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Vous approchez du plafond : parlez-en à votre comptable avant de le dépasser.</p> : null}
              <p className="text-xs text-muted">Chaque année : listing clients assujettis à rentrer avant le 31 mars. Vérifiez le plafond en vigueur avec votre comptable.</p>
            </div>
          </Card>
        )}
        <Card>
          <CardHeader title="Recettes et dépenses" description="12 derniers mois, HTVA" />
          <div className="flex h-52 items-end gap-1.5 px-5 pb-2" role="img" aria-label={series.map((s) => `${monthLabel(s.month)} : recettes ${eur(s.income)}, dépenses ${eur(s.expenses)}`).join(" ; ")}>
            {series.map((s) => (
              <div key={s.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div className="flex h-full w-full items-end justify-center gap-0.5">
                  <div className="w-1/2 max-w-3 rounded-t bg-accent" style={{ height: `${(s.income / max) * 100}%`, minHeight: s.income ? 2 : 0 }} />
                  <div className="w-1/2 max-w-3 rounded-t bg-border-strong" style={{ height: `${(s.expenses / max) * 100}%`, minHeight: s.expenses ? 2 : 0 }} />
                </div>
                <span className="text-[10px] text-muted">{monthLabel(s.month)}</span>
              </div>
            ))}
          </div>
          <p className="flex gap-4 px-5 pb-4 text-xs text-muted"><span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-accent" aria-hidden="true" />Recettes</span><span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-border-strong" aria-hidden="true" />Dépenses</span></p>
        </Card>
        <Card>
          <CardHeader title="Factures à encaisser" />
          {rec.rows.length === 0 ? <p className="px-5 py-4 text-sm text-muted">Tout est payé.</p> : (
            <ul className="divide-y divide-border">
              {rec.rows.slice(0, 10).map((r) => <li key={r.id}><Link href={`/app/factures/${r.id}`} className="flex items-center gap-3 px-5 py-2 text-sm hover:bg-surface-muted/60"><span className="font-medium tabular-nums">{r.number}</span><span className="min-w-0 flex-1 truncate text-muted">{String(r.client?.name ?? "")}</span><span className={cn("text-xs", r.due && r.due < today ? "text-danger" : "text-muted")}>{r.due ? `échéance ${r.due.split("-").reverse().join("/")}` : ""}</span><span className="w-20 text-right tabular-nums">{eur(r.ttc)}</span></Link></li>)}
            </ul>
          )}
        </Card>
        {a.expenses.byCategory.length ? (
          <Card>
            <CardHeader title="Dépenses par catégorie" description={`${range.label}, HTVA`} />
            <ul className="divide-y divide-border text-sm">{a.expenses.byCategory.map(([k, v]) => <li key={k} className="flex justify-between px-5 py-2"><span>{k}</span><span className="tabular-nums">{eur(v)}</span></li>)}</ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}

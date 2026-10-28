import type { Metadata } from "next";
import Link from "next/link";
import { Check, CircleAlert, Clock, FileText, Landmark, Plus, TrendingUp, Wallet } from "lucide-react";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StateBadge } from "@/components/invoicing/doc-list";
import { cn } from "@/lib/cn";
import { docState, fdate, FRANCHISE_LIMIT, moneyCents, todayIso } from "@/lib/invoicing";
import { requireContext } from "@/server/context";
import { dashboardStats, getSellerSettings, listDocuments } from "@/server/invoicing";

export const metadata: Metadata = { title: "Factures · Tableau de bord" };

const MONTHS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

export default async function Page({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const ctx = await requireContext("invoices.view");
  const today = todayIso(ctx.business.timezone);
  const thisYear = Number(today.slice(0, 4));
  const y = Number((await searchParams).annee);
  const year = y >= 2000 && y <= thisYear + 1 ? y : thisYear;
  const [stats, seller, docs, [{ n: nbClients }]] = await Promise.all([
    dashboardStats(ctx.business.id, year, today),
    getSellerSettings(ctx.business.id),
    listDocuments(ctx.business.id, ["invoice", "credit"]),
    db.select({ n: count() }).from(customers).where(and(eq(customers.businessId, ctx.business.id))),
  ]);
  const canManage = ctx.can("invoices.manage");
  const steps = [
    { done: seller.saved, title: "Complétez vos infos", text: "Nom, adresse, n° d'entreprise, IBAN", href: "/app/factures/reglages" },
    { done: nbClients > 0, title: "Ajoutez un client", text: "Ou utilisez ceux de vos rendez-vous", href: "/app/clients" },
    { done: docs.some((d) => d.number), title: "Émettez votre première facture", text: "Numérotée et prête en PDF", href: "/app/factures/nouvelle?type=facture" },
  ];
  const max = Math.max(1, ...stats.monthsCents);
  const franchise = seller.vatRegime === "franchise";
  const pct = Math.min(100, Math.round((stats.revenueCents / 100 / FRANCHISE_LIMIT) * 100));
  const latest = docs.filter((d) => d.number).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de votre facturation."
        action={
          <>
            <nav className="inline-flex rounded-lg bg-surface-muted p-1" aria-label="Année">
              {[thisYear - 1, thisYear].map((yy) => (
                <Link key={yy} href={yy === thisYear ? "/app/factures" : `/app/factures?annee=${yy}`} aria-current={yy === year ? "page" : undefined} className={cn("flex h-8 items-center rounded-md px-3 text-sm font-medium", yy === year ? "bg-surface shadow-sm" : "text-muted hover:text-text")}>{yy}</Link>
              ))}
            </nav>
            {canManage ? <ButtonLink href="/app/factures/nouvelle?type=facture" icon={<Plus className="size-4" aria-hidden="true" />}>Nouvelle facture</ButtonLink> : null}
          </>
        }
      />

      {steps.some((s) => !s.done) ? (
        <Card className="mb-6">
          <CardHeader title="Bien démarrer" action={<span className="text-sm text-muted tabular-nums">{steps.filter((s) => s.done).length} / 3</span>} />
          <ol className="grid grid-cols-1 gap-3 p-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title}>
                <Link href={s.href} className={cn("flex h-full items-start gap-3 rounded-xl border p-4 transition-colors", s.done ? "border-border bg-surface-muted" : "border-border hover:border-border-strong")}>
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold", s.done ? "bg-success text-white" : "border border-border-strong text-muted")}>{s.done ? <Check className="size-4" aria-hidden="true" /> : i + 1}</span>
                  <span>
                    <span className={cn("block text-sm font-semibold", s.done && "text-muted line-through")}>{s.title}</span>
                    <span className="block text-sm text-muted">{s.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { icon: TrendingUp, label: `Chiffre d'affaires ${year}`, value: moneyCents(stats.revenueCents), sub: `${stats.invoiceCount} facture${stats.invoiceCount > 1 ? "s" : ""} émise${stats.invoiceCount > 1 ? "s" : ""}${franchise ? "" : " · hors TVA"}` },
          { icon: Wallet, label: `Encaissé ${year}`, value: moneyCents(stats.paidCents), sub: `${stats.paidCount} paiement${stats.paidCount > 1 ? "s" : ""} reçu${stats.paidCount > 1 ? "s" : ""}` },
          { icon: Clock, label: "À encaisser", value: moneyCents(stats.openCents), sub: stats.overdue.length ? `dont ${stats.overdue.length} en retard` : `${stats.openCount} facture${stats.openCount > 1 ? "s" : ""} en attente` },
        ].map((k) => (
          <Card key={k.label} className="p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted"><k.icon className="size-4" aria-hidden="true" />{k.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{k.value}</p>
            <p className="mt-1 text-sm text-muted">{k.sub}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={`Chiffre d'affaires par mois${franchise ? "" : " (HTVA)"}`} />
            <div className="p-5">
              <div className="flex h-48 items-end gap-1.5 sm:gap-2" role="img" aria-label={`Chiffre d'affaires par mois en ${year}`}>
                {stats.monthsCents.map((c, i) => (
                  <div key={i} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 self-stretch">
                    <span className="hidden text-[11px] whitespace-nowrap text-muted tabular-nums opacity-0 transition-opacity group-hover:opacity-100 sm:block" title={c ? moneyCents(c) : undefined}>{c ? new Intl.NumberFormat("fr-BE", { notation: "compact", maximumFractionDigits: 1 }).format(c / 100) + " €" : ""}</span>
                    <div className={cn("w-full rounded-t-md", c > 0 ? "bg-accent" : "bg-surface-muted")} style={{ height: `${Math.max(3, (Math.max(0, c) / max) * 100)}%` }} />
                    <span className={cn("text-[11px] text-muted", year === thisYear && i === Number(today.slice(5, 7)) - 1 && "font-semibold text-text")}><span className="sm:hidden">{MONTHS[i]!.charAt(0)}</span><span className="hidden sm:inline">{MONTHS[i]}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          {franchise ? (
            <Card className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold"><Landmark className="size-4 text-muted" aria-hidden="true" />Seuil de franchise TVA {year}</p>
                <p className="text-sm tabular-nums text-muted">{moneyCents(stats.revenueCents)} / {FRANCHISE_LIMIT.toLocaleString("fr-BE")} €</p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-muted"><div className={cn("h-full rounded-full", pct >= 90 ? "bg-danger" : pct >= 75 ? "bg-warning" : "bg-accent")} style={{ width: `${pct}%` }} /></div>
              <p className="mt-2 text-sm text-muted">{pct >= 90 ? "Vous approchez du seuil : parlez-en à votre comptable pour passer à la TVA." : `Vous avez utilisé ${pct} % du seuil annuel.`}</p>
            </Card>
          ) : null}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="À relancer" action={stats.overdue.length ? <span className="rounded-full bg-danger-soft px-2 text-sm font-semibold text-danger tabular-nums">{stats.overdue.length}</span> : undefined} />
            {stats.overdue.length ? (
              <ul className="divide-y divide-border">
                {stats.overdue.map((d) => (
                  <li key={d.id}>
                    <Link href={`/app/factures/${d.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-muted">
                      <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{String(d.client?.name ?? "—")}</span><span className="block text-muted tabular-nums">{d.number} · échue le {fdate(d.dueDate)}</span></span>
                      <span className="font-medium tabular-nums">{moneyCents(d.ttc)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm text-muted">Aucune facture en retard. Bien joué.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Dernières factures" action={<Link href="/app/factures/liste" className="text-sm font-medium text-accent hover:text-accent-hover">Tout voir</Link>} />
            {latest.length ? (
              <ul className="divide-y divide-border">
                {latest.map((d) => (
                  <li key={d.id}>
                    <Link href={`/app/factures/${d.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-muted">
                      <FileText className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{String(d.client?.name ?? "—")}</span><span className="block text-muted tabular-nums">{d.number}</span></span>
                      <StateBadge state={docState(d, today)} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm text-muted">Vos factures émises apparaîtront ici.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

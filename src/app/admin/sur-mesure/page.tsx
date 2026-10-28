import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { REQUEST_STATUS, fmtEuros, type RequestStatus } from "@/lib/custom-work";
import { requireSuperadmin } from "@/server/admin";
import { allRequests } from "@/server/custom-work";

export const metadata: Metadata = { title: "Sur mesure" };

/** Demandes sur mesure de toutes les entreprises Skydev. */
export default async function AdminCustomRequests({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  await requireSuperadmin();
  const sp = await searchParams;
  const status = sp.statut && sp.statut in REQUEST_STATUS ? sp.statut : undefined;
  const rows = await allRequests(status);
  const fmt = new Intl.DateTimeFormat("fr-BE", { dateStyle: "medium", timeZone: "Europe/Brussels" });
  return (
    <>
      <PageHeader title="Sur mesure" description="Demandes des clients : proposez un prix, suivez l'avancement, activez la modif pour leur seule entreprise." />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/sur-mesure" aria-current={!status ? "page" : undefined} className={!status ? "rounded-full bg-accent-soft px-3 py-1 font-medium text-accent" : "rounded-full border border-border px-3 py-1"}>Toutes</Link>
        {Object.entries(REQUEST_STATUS).map(([k, v]) => <Link key={k} href={`/admin/sur-mesure?statut=${k}`} aria-current={status === k ? "page" : undefined} className={status === k ? "rounded-full bg-accent-soft px-3 py-1 font-medium text-accent" : "rounded-full border border-border px-3 py-1"}>{v.label}</Link>)}
      </div>
      <Card className="overflow-hidden">
        {!rows.length ? <p className="p-6 text-sm text-muted">Aucune demande.</p> : (
          <ul className="divide-y divide-border text-sm">
            {rows.map(({ r, business, name }) => (
              <li key={r.id}>
                <Link href={`/admin/sur-mesure/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-muted/60">
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.title}</span><span className="text-muted">{business}{name ? ` · ${name}` : ""} · {fmt.format(r.createdAt)}</span></span>
                  {r.setupCents || r.monthlyCents ? <span className="tabular-nums text-muted">{[fmtEuros(r.setupCents), r.monthlyCents ? `${fmtEuros(r.monthlyCents)}/mois` : null].filter(Boolean).join(" + ")}</span> : null}
                  <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs font-medium">{REQUEST_STATUS[r.status as RequestStatus]?.label ?? r.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

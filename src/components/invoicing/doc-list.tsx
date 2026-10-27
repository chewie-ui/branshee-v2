import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { docState, fdate, moneyCents, STATE_LABEL, type DocState } from "@/lib/invoicing";
import type { SalesDoc } from "@/server/invoicing";

export function StateBadge({ state }: { state: DocState }) {
  const [label, tone] = STATE_LABEL[state];
  return <Badge tone={tone}>{label}</Badge>;
}

const clientName = (d: SalesDoc, names: Map<string, string>) => String(d.client?.name ?? (d.customerId ? names.get(d.customerId) : "") ?? "") || "—";

/** Liste de factures ou de devis, avec filtres par état. */
export function DocList({ docs, today, quotes, filter, filters, names, canManage }: { docs: SalesDoc[]; today: string; quotes: boolean; filter: string; filters: { key: string; label: string }[]; names: Map<string, string>; canManage: boolean }) {
  const rows = docs.filter((d) => filter === "all" || docState(d, today) === filter || (filter === "open" && docState(d, today) === "overdue"));
  const base = quotes ? "/app/factures/devis" : "/app/factures/liste";
  return (
    <>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filtrer">
        {filters.map((f) => {
          const n = f.key === "all" ? docs.length : docs.filter((d) => docState(d, today) === f.key || (f.key === "open" && docState(d, today) === "overdue")).length;
          return (
            <Link key={f.key} href={f.key === "all" ? base : `${base}?f=${f.key}`} aria-current={filter === f.key ? "page" : undefined} className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors", filter === f.key ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border-strong text-muted hover:text-text")}>
              {f.label}
              <span className="text-xs tabular-nums opacity-70">{n}</span>
            </Link>
          );
        })}
      </nav>
      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={<FilePlus2 />}
            title={docs.length ? "Rien dans ce filtre" : quotes ? "Aucun devis" : "Aucune facture"}
            description={docs.length ? "Aucun document ne correspond à ce filtre." : quotes ? "Un devis clair aide à signer plus vite. Quand le client accepte, transformez-le en facture." : "Créez votre première facture : numérotée, conforme et prête en PDF."}
            action={!docs.length && canManage ? <ButtonLink href={`/app/factures/nouvelle?type=${quotes ? "devis" : "facture"}`}>{quotes ? "Créer un devis" : "Créer une facture"}</ButtonLink> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted">
                  <th className="px-5 py-3 font-medium">Numéro</th>
                  <th className="px-3 py-3 font-medium">Client</th>
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">{quotes ? "Validité" : "Échéance"}</th>
                  <th className="px-3 py-3 text-right font-medium">Montant</th>
                  <th className="px-5 py-3 text-right font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-surface-muted">
                    <td className="px-5 py-3 font-medium tabular-nums">
                      <Link href={`/app/factures/${d.id}`} className="hover:text-accent hover:underline">{d.number ?? "Brouillon"}</Link>
                      {d.docType === "credit" ? <span className="ml-2 text-xs text-muted">Note de crédit</span> : null}
                    </td>
                    <td className="max-w-56 truncate px-3 py-3"><Link href={`/app/factures/${d.id}`} className="hover:text-accent">{clientName(d, names)}</Link></td>
                    <td className="px-3 py-3 tabular-nums text-muted">{fdate(d.issueDate)}</td>
                    <td className="px-3 py-3 tabular-nums text-muted">{fdate(quotes ? d.validUntil : d.dueDate)}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{d.docType === "credit" ? "−" : ""}{moneyCents(d.ttcCents)}</td>
                    <td className="px-5 py-3 text-right"><StateBadge state={docState(d, today)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

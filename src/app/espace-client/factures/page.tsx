import type { Metadata } from "next";
import { Download, FileText } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listMyInvoices, requireClient } from "@/server/client-account";

export const metadata: Metadata = { title: "Mes factures" };

const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);
const day = (iso: string) => iso.split("-").reverse().join("/");

export default async function MyInvoices() {
  const user = await requireClient("/espace-client/factures");
  const list = await listMyInvoices(user.id);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mes factures</h1>
        <p className="mt-1 text-sm text-muted">Toutes les factures et notes de crédit que les pros vous ont émises, téléchargeables à tout moment.</p>
      </div>
      {list.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">
          <FileText className="mx-auto mb-2 size-8" aria-hidden="true" />
          Vos factures apparaîtront ici, chez tous les pros qui utilisent Skydev avec l&apos;adresse {user.email}.
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {list.map((d) => {
              const credit = d.docType === "credit";
              const st = credit ? { label: "Note de crédit", tone: "neutral" as const } : d.status === "paid" ? { label: "Payée", tone: "success" as const } : d.status === "cancelled" ? { label: "Annulée", tone: "danger" as const } : { label: "À payer", tone: "warning" as const };
              return (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={d.business.name} src={d.business.photoUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.business.name}</p>
                    <p className="text-xs text-muted">
                      {credit ? "Note de crédit" : "Facture"} {d.number} · {day(d.issueDate)}
                      {!credit && d.status === "sent" && d.dueDate ? ` · à payer avant le ${day(d.dueDate)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{credit ? "−" : ""}{eur(d.ttcCents)}</p>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <a href={`/espace-client/factures/${d.id}`} className="inline-flex size-11 items-center justify-center rounded-lg border border-border-strong hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label={`Télécharger ${credit ? "la note de crédit" : "la facture"} ${d.number}`}>
                      <Download className="size-4" aria-hidden="true" />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

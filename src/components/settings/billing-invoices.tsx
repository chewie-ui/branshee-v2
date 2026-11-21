import { Download, ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { appT } from "@/server/app-locale";
import { businessInvoices } from "@/server/billing-invoices";

const money = (c: number, cur: string) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: cur.toUpperCase() }).format(c / 100);
const day = (iso: string) => new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Brussels" }).format(new Date(iso));

/** « Vos factures » : chaque facture de l'abonnement, en PDF, avec le paiement en ligne si elle est à payer. */
export async function BillingInvoices({ businessId, brand }: { businessId: string; brand: string }) {
  const [t, invoices] = await Promise.all([appT(), businessInvoices(businessId)]);
  const STATUS = {
    paid: { label: t("Payée"), tone: "success" as const },
    open: { label: t("À payer"), tone: "warning" as const },
    void: { label: t("Annulée"), tone: "neutral" as const },
    uncollectible: { label: t("Impayée"), tone: "danger" as const },
  };
  return (
    <Card id="factures">
      <CardHeader title={t("Vos factures")} description={t("Les factures de votre abonnement {brand}, à télécharger en PDF. Elles vous sont aussi envoyées par email.", { brand })} />
      {invoices.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted">
          <FileText className="size-8" aria-hidden="true" />
          <p>{t("Aucune facture pour l'instant : la première arrive au premier paiement de votre abonnement.")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {invoices.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t("Facture")} {i.number ?? ""}</p>
                <p className="text-xs text-muted">{day(i.date)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">{money(i.totalCents, i.currency)}</span>
                <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>
                {i.payUrl ? (
                  <a href={i.payUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    {t("Payer")} <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                ) : null}
                {i.pdf ? (
                  <a href={i.pdf} target="_blank" rel="noopener noreferrer" aria-label={t("Télécharger la facture {n} en PDF", { n: i.number ?? "" })} className="inline-flex size-11 items-center justify-center rounded-lg border border-border-strong transition-colors duration-150 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    <Download className="size-4" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink, FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay } from "@/lib/time";
import { requireSuperadmin } from "@/server/admin";
import { filterDocs, listAdminDocuments, STATUS_LABEL, totalsOf, type AdminDoc } from "@/server/admin-invoices";

export const metadata: Metadata = { title: "Factures" };

const TZ = "Europe/Brussels";
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

const FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "paid", label: "Payées" },
  { value: "open", label: "À payer" },
  { value: "void", label: "Annulées" },
  { value: "credit", label: "Notes de crédit" },
];

function tone(d: AdminDoc) {
  if (d.kind === "credit") return "accent" as const;
  return d.status === "paid" ? ("success" as const) : d.status === "open" ? ("warning" as const) : d.status === "uncollectible" ? ("danger" as const) : ("neutral" as const);
}

/** Toutes les factures et notes de crédit émises par Branshee (Stripe), avec le client et son établissement. */
export default async function AdminInvoices({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string; periode?: string }> }) {
  await requireSuperadmin();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const status = FILTERS.some((f) => f.value === sp.statut) ? sp.statut! : "all";
  const period = /^\d{4}(-\d{2})?$/.test(sp.periode ?? "") ? sp.periode! : "";

  const { docs, configured, truncated } = await listAdminDocuments();
  const shown = filterDocs(docs, { status, q, period });
  const t = totalsOf(filterDocs(docs, { q, period }));
  const months = [...new Set(docs.map((d) => d.date.toISOString().slice(0, 7)))].sort().reverse();
  const href = (p: Record<string, string>) => {
    const u = new URLSearchParams({ ...(q ? { q } : {}), ...(status !== "all" ? { statut: status } : {}), ...(period ? { periode: period } : {}), ...p });
    for (const [k, v] of [...u.entries()]) if (!v || v === "all") u.delete(k);
    const s = u.toString();
    return s ? `/admin/factures?${s}` : "/admin/factures";
  };
  const exportHref = `/admin/factures/export${period ? `?periode=${period}` : ""}`;

  return (
    <>
      <PageHeader
        title="Factures"
        description="Toutes les factures et notes de crédit de vos clients (Stripe)."
        action={
          <a href={exportHref} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <Download className="size-4" aria-hidden="true" />
            Exporter pour le comptable (CSV)
          </a>
        }
      />

      {!configured ? (
        <Card className="p-5 text-sm text-muted">Stripe n&apos;est pas configuré sur ce serveur.</Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Encaissé TVAC", value: eur(t.ttc), sub: `${t.paid} facture${t.paid > 1 ? "s" : ""} payée${t.paid > 1 ? "s" : ""}` },
              { label: "Hors TVA", value: eur(t.ht), sub: "Notes de crédit déduites" },
              { label: "TVA à déclarer", value: eur(t.vat), sub: "Sur les factures payées" },
              { label: "À encaisser", value: eur(t.open), sub: "Factures ouvertes" },
            ].map((k) => (
              <Card key={k.label} className="p-4">
                <p className="text-sm text-muted">{k.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{k.value}</p>
                <p className="text-xs text-muted">{k.sub}{period ? ` · ${period}` : ""}</p>
              </Card>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <form className="relative w-full max-w-sm" role="search">
              {status !== "all" ? <input type="hidden" name="statut" value={status} /> : null}
              {period ? <input type="hidden" name="periode" value={period} /> : null}
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input name="q" defaultValue={q} placeholder="N°, client, email, TVA, établissement" className="pl-9" aria-label="Rechercher une facture" />
            </form>
            <nav aria-label="Statut" className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <Link key={f.value} href={href({ statut: f.value })} aria-current={status === f.value ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${status === f.value ? "bg-accent-soft text-accent-soft-foreground" : "text-muted hover:bg-surface-muted hover:text-text"}`}>
                  {f.label}
                </Link>
              ))}
            </nav>
            <nav aria-label="Période" className="flex flex-wrap items-center gap-1 text-sm">
              <Link href={href({ periode: "" })} aria-current={!period ? "page" : undefined} className={`rounded-lg px-2.5 py-1.5 ${!period ? "bg-surface-muted font-medium" : "text-muted hover:text-text"}`}>Tout</Link>
              {months.slice(0, 12).map((m) => (
                <Link key={m} href={href({ periode: m })} aria-current={period === m ? "page" : undefined} className={`rounded-lg px-2.5 py-1.5 tabular-nums ${period === m ? "bg-surface-muted font-medium" : "text-muted hover:text-text"}`}>
                  {formatDay(new Date(`${m}-15T12:00:00Z`), TZ, "MMM yyyy")}
                </Link>
              ))}
            </nav>
          </div>

          <Card className="relative overflow-x-auto">
            {shown.length === 0 ? (
              <p className="p-5 text-sm text-muted">Aucune facture pour ces critères.</p>
            ) : (
              <table className="w-full min-w-[860px] text-sm">
                <thead className="border-b border-border text-left text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">N° et date</th>
                    <th className="px-3 py-2.5 font-medium">Client</th>
                    <th className="px-3 py-2.5 font-medium">Objet</th>
                    <th className="px-3 py-2.5 text-right font-medium">HTVA</th>
                    <th className="px-3 py-2.5 text-right font-medium">TVA</th>
                    <th className="px-3 py-2.5 text-right font-medium">TVAC</th>
                    <th className="px-3 py-2.5 font-medium">Statut</th>
                    <th className="px-5 py-2.5 text-right font-medium"><span className="sr-only">Documents</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((d) => (
                    <tr key={d.id} className="align-top">
                      <td className="px-5 py-3">
                        <span className="block font-medium whitespace-nowrap tabular-nums">{d.number ?? "Sans numéro"}</span>
                        <span className="block whitespace-nowrap text-muted">{formatDay(d.date, TZ, "d MMM yyyy")}</span>
                        {d.kind === "credit" && d.refInvoice ? <span className="block text-xs text-muted">sur {d.refInvoice}</span> : null}
                      </td>
                      <td className="max-w-[240px] px-3 py-3">
                        <span className="block truncate font-medium">{d.customerName || "—"}</span>
                        <span className="block truncate text-muted">{d.customerEmail}</span>
                        {d.customerVat ? <span className="block truncate text-xs text-muted">TVA {d.customerVat}</span> : null}
                        {d.customerAddress ? null : d.kind === "invoice" && d.status === "paid" ? <span className="block text-xs text-warning">Adresse manquante</span> : null}
                        {d.businessId ? (
                          <Link href={`/admin/etablissements/${d.businessId}`} className="block truncate text-xs text-accent hover:underline">{d.businessName ?? "Établissement"}</Link>
                        ) : d.userId ? (
                          <Link href={`/admin/utilisateurs/${d.userId}`} className="block truncate text-xs text-accent hover:underline">Voir le compte</Link>
                        ) : null}
                      </td>
                      <td className="max-w-[220px] px-3 py-3">
                        <span className="block truncate">{d.description || "—"}</span>
                        {d.periodStart && d.periodEnd && d.periodEnd.getTime() !== d.periodStart.getTime() ? (
                          <span className="block text-xs text-muted">{formatDay(d.periodStart, TZ, "d MMM")} → {formatDay(d.periodEnd, TZ, "d MMM yyyy")}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{d.kind === "credit" ? "−" : ""}{eur(d.htCents)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{d.kind === "credit" ? "−" : ""}{eur(d.vatCents)}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{d.kind === "credit" ? "−" : ""}{eur(d.ttcCents)}</td>
                      <td className="px-3 py-3">
                        <Badge tone={tone(d)}>{d.kind === "credit" ? (d.status === "void" ? "Note annulée" : "Note de crédit") : (STATUS_LABEL[d.status] ?? d.status)}</Badge>
                        {d.paidAt ? <span className="mt-1 block text-xs text-muted">le {formatDay(d.paidAt, TZ, "d MMM")}</span> : null}
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex justify-end gap-1">
                          {d.pdf ? (
                            <a href={d.pdf} target="_blank" rel="noopener noreferrer" aria-label={`PDF de ${d.number ?? "la facture"}`} className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent">
                              <FileText className="size-4" aria-hidden="true" />
                            </a>
                          ) : null}
                          {d.hosted ? (
                            <a href={d.hosted} target="_blank" rel="noopener noreferrer" aria-label={`Page Stripe de ${d.number ?? "la facture"}`} className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent">
                              <ExternalLink className="size-4" aria-hidden="true" />
                            </a>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <p className="mt-3 text-xs text-muted">
            {shown.length} document{shown.length > 1 ? "s" : ""}{truncated ? " · liste limitée aux 2 000 plus récents" : ""}. Les factures annulées gardent leur numéro pour que la série reste continue.
          </p>
        </>
      )}
    </>
  );
}

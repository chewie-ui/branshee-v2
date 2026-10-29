import Link from "next/link";
import { FileText, FolderOpen, FolderKanban, Gift, ShoppingBag, Star, Store, Target, Truck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { stageLabel } from "@/lib/sales";
import { PROJECT_STATUS } from "@/lib/projects";
import { INTERVENTION_STATUS, type InterventionStatus } from "@/lib/interventions";
import { SHOP_STATUS, type ShopStatus } from "@/lib/shop";
import type { customerActivity } from "@/server/customer-activity";

type Activity = Awaited<ReturnType<typeof customerActivity>>;
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);
const day = (d: Date | string) => new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", year: "numeric" }).format(typeof d === "string" ? new Date(`${d}T12:00:00Z`) : d);
const DOC_STATUS: Record<string, string> = { draft: "Brouillon", sent: "Envoyé", paid: "Payée", cancelled: "Annulée", accepted: "Accepté", refused: "Refusé", invoiced: "Facturé" };

/** Onglet « Tout » de la fiche client : devis, factures, ventes, projets, interventions, commandes, fidélité, avis, fichiers. */
export function CustomerActivity({ a, customerId }: { a: Activity; customerId: string }) {
  const blocks = [
    a.finance ? { key: "docs", title: "Devis et factures", icon: FileText, action: <Link href={`/app/factures/nouvelle?client=${customerId}`} className="text-sm font-medium text-accent hover:text-accent-hover">Nouvelle facture</Link>, items: a.docs.map((d) => ({ href: `/app/factures/${d.id}`, label: `${d.docType === "quote" ? "Devis" : d.docType === "credit" ? "Note de crédit" : "Facture"} ${d.number ?? "(brouillon)"}`, sub: `${day(d.date)} · ${DOC_STATUS[d.status] ?? d.status}`, value: eur(d.ttc) })) } : null,
    { key: "deals", title: "Ventes", icon: Target, items: a.deals.map((d) => ({ href: `/app/ventes?piste=${d.id}`, label: d.title, sub: stageLabel(d.stage), value: eur(d.value) })) },
    { key: "projects", title: "Projets", icon: FolderKanban, items: a.projects.map((p) => ({ href: `/app/projets/${p.id}`, label: p.name, sub: PROJECT_STATUS[p.status as keyof typeof PROJECT_STATUS] ?? p.status, value: "" })) },
    { key: "interventions", title: "Interventions", icon: Truck, items: a.interventions.map((i) => ({ href: `/app/interventions/${i.id}`, label: `${i.title} · n° ${i.number}`, sub: `${i.at ? day(i.at) : "Sans date"} · ${INTERVENTION_STATUS[i.status as InterventionStatus]?.label ?? i.status}`, value: "" })) },
    { key: "orders", title: "Commandes en ligne", icon: ShoppingBag, items: a.orders.map((o) => ({ href: "/app/boutique", label: `Commande n° ${o.number}`, sub: `${day(o.at)} · ${SHOP_STATUS[o.status as ShopStatus]?.label ?? o.status}`, value: eur(o.total) })) },
    { key: "files", title: "Fichiers", icon: FolderOpen, items: a.files.map((f) => ({ href: `/app/documents/${f.id}/fichier`, label: f.name, sub: day(f.at), value: "" })) },
  ].filter((b): b is NonNullable<typeof b> => !!b);
  const shown = blocks.filter((b) => b.items.length || b.key === "docs");
  const empty = blocks.every((b) => !b.items.length) && !a.card && !a.reviews.length && !a.pos?.n;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {empty ? <Card className="p-8 text-center text-sm text-muted lg:col-span-2">Rien d&apos;autre pour l&apos;instant : devis, factures, projets, commandes ou fichiers liés à cette fiche apparaîtront ici.</Card> : null}
      {(a.pos?.n || a.card || a.reviews.length) ? (
        <Card className="lg:col-span-2">
          <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="flex items-center gap-3 p-4"><Store className="size-5 text-muted" aria-hidden="true" /><div><p className="text-sm text-muted">Achats en caisse</p><p className="font-semibold tabular-nums">{a.pos?.n ? `${a.pos.n} · ${eur(a.pos.total)}` : "—"}</p></div></div>
            <div className="flex items-center gap-3 p-4"><Gift className="size-5 text-muted" aria-hidden="true" /><div><p className="text-sm text-muted">Fidélité</p><p className="font-semibold">{a.card ? `${a.card.stamps} tampon${a.card.stamps > 1 ? "s" : ""}${a.card.rewards ? ` · ${a.card.rewards} récompense${a.card.rewards > 1 ? "s" : ""}` : ""}` : "—"}</p></div></div>
            <div className="flex items-center gap-3 p-4"><Star className="size-5 text-muted" aria-hidden="true" /><div><p className="text-sm text-muted">Avis Google</p><p className="font-semibold">{a.reviews.length ? (a.reviews.some((r) => r.clicked) ? "Parti vers Google" : a.reviews.some((r) => r.feedback) ? "Remarque privée" : `Demandé le ${day(a.reviews[0]!.at)}`) : "—"}</p></div></div>
          </div>
        </Card>
      ) : null}
      {shown.map((b) => (
        <Card key={b.key} className={shown.length === 1 ? "lg:col-span-2" : undefined}>
          <CardHeader title={b.title} action={b.action} />
          {b.items.length ? (
            <ul className="divide-y divide-border">
              {b.items.map((it, i) => (
                <li key={i}>
                  <Link href={it.href} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-surface-muted/60">
                    <b.icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{it.label}</span><span className="block truncate text-xs text-muted">{it.sub}</span></span>
                    {it.value ? <span className="tabular-nums">{it.value}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="px-5 py-4 text-sm text-muted">Aucun pour l&apos;instant.</p>}
        </Card>
      ))}
    </div>
  );
}

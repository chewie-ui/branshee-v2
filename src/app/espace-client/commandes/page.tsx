import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDay } from "@/lib/time";
import { listMyOrders, requireClient } from "@/server/client-account";
import { pickupCode } from "@/server/shop";

export const metadata: Metadata = { title: "Mes commandes" };

const STATUS: Record<string, { label: string; tone: "neutral" | "warning" | "success" | "danger" | "accent" }> = {
  pending_payment: { label: "Paiement en attente", tone: "warning" },
  new: { label: "Reçue", tone: "accent" },
  ready: { label: "Prête à retirer", tone: "success" },
  shipped: { label: "Expédiée", tone: "success" },
  done: { label: "Terminée", tone: "neutral" },
  cancelled: { label: "Annulée", tone: "danger" },
};
const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;

export default async function MyOrders() {
  const user = await requireClient("/espace-client/commandes");
  const list = await listMyOrders(user.email);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Mes commandes</h1>
      {list.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">
          <ShoppingBag className="mx-auto mb-2 size-8" aria-hidden="true" />
          Vos commandes en ligne (à retirer ou livrées) apparaîtront ici, si vous commandez avec l&apos;adresse {user.email}.
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {list.map((o) => {
              const st = STATUS[o.status] ?? { label: o.status, tone: "neutral" as const };
              const showCode = o.fulfilment === "pickup" && !["pending_payment", "cancelled", "done"].includes(o.status);
              const items = o.lines.reduce((n, l) => n + l.qty, 0);
              return (
                <li key={o.id}>
                  <Link href={`/commande/${o.token}`} className="flex items-center gap-4 px-5 py-4 text-sm transition-colors duration-150 hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                    <Avatar name={o.business.name} src={o.business.photoUrl} />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="flex flex-wrap items-center gap-2"><span className="font-medium">{o.business.name}</span><Badge tone={st.tone}>{st.label}</Badge></p>
                      <p className="text-muted">
                        Commande n° {o.number} · {formatDay(o.createdAt, "Europe/Brussels", "d MMMM yyyy")} · {items} article{items > 1 ? "s" : ""} · {eur(o.totalCents)}
                      </p>
                    </div>
                    {showCode ? (
                      <span className="text-right">
                        <span className="block text-xs text-muted">Code de retrait</span>
                        <span className="block font-mono text-lg font-bold tracking-widest">{pickupCode(o.token)}</span>
                      </span>
                    ) : null}
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

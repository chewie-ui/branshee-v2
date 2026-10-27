import type { Metadata } from "next";
import { OrdersBoard } from "@/components/orders/orders-board";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { recentOrders, tablesOf } from "@/server/orders";

export const metadata: Metadata = { title: "Commandes" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const ctx = await requireContext();
  const [orders, tables] = await Promise.all([recentOrders(ctx.business.id), tablesOf(ctx.business.id)]);
  return (
    <>
      <PageHeader title="Commandes" description="Les commandes passées par QR code, en direct. La page se met à jour toute seule." />
      <OrdersBoard
        hasTables={tables.length > 0}
        canEdit={ctx.member.isOwner || ctx.can("settings.manage")}
        tz={ctx.business.timezone || "Europe/Brussels"}
        orders={orders.map((o) => ({ id: o.id, number: o.number, status: o.status, table: o.tableLabel, lines: o.lines, totalCents: o.totalCents, customerName: o.customerName, note: o.note, paid: !!o.paidAt, createdAt: o.createdAt.toISOString() }))}
      />
    </>
  );
}

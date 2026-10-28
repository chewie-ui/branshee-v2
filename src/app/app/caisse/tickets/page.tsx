import type { Metadata } from "next";
import { SalesList } from "@/components/pos/sales-list";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { salesToday, stockRights } from "@/server/stock";

export const metadata: Metadata = { title: "Tickets" };

export default async function TicketsPage() {
  const ctx = await requireContext();
  const rows = await salesToday(ctx.business.id, 30);
  return (
    <>
      <PageHeader title="Tickets" description="Les tickets des 30 derniers jours." />
      <SalesList canRefund={stockRights(ctx).manage} tz={ctx.business.timezone || "Europe/Brussels"} rows={rows.map((s) => ({ id: s.id, number: s.number, total: s.totalCents, method: s.method, status: s.status, createdAt: s.createdAt.toISOString(), items: s.lines.reduce((a, l) => a + l.qty, 0) }))} />
    </>
  );
}

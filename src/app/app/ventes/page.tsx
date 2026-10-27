import type { Metadata } from "next";
import { SalesBoard } from "@/components/sales/sales-board";
import { PageHeader } from "@/components/ui/page-header";
import { todayIn } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { listDeals, salesMembers, salesRights } from "@/server/sales";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Ventes" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ piste?: string }> }) {
  const ctx = await requireContext();
  const rights = salesRights(ctx);
  if (!rights.view) redirect("/app/acces-refuse");
  const [deals, team] = await Promise.all([listDeals(ctx.business.id), salesMembers(ctx.business.id)]);
  const open = (await searchParams).piste;
  return (
    <>
      <PageHeader title="Ventes" description="Vos pistes commerciales, du premier contact à la signature." />
      <SalesBoard deals={deals} team={team} me={ctx.member.id} canManage={rights.manage} canQuote={ctx.can("invoices.manage")} today={todayIn(ctx.business.timezone || "Europe/Brussels")} openId={open && deals.some((d) => d.id === open) ? open : null} />
    </>
  );
}

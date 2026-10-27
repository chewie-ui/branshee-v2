import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AllowanceTable } from "@/components/leave/leave-ui";
import { requireContext } from "@/server/context";
import { leaveBalances, leaveMembers, leaveRights } from "@/server/leave";

export const metadata: Metadata = { title: "Soldes de congés" };

const todayIn = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default async function BalancesPage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const ctx = await requireContext();
  if (!leaveRights(ctx).approve) redirect("/app/conges");
  const today = todayIn(ctx.business.timezone || "Europe/Brussels");
  const q = Number((await searchParams).annee);
  const year = q >= 2000 && q <= 2100 ? q : Number(today.slice(0, 4));
  const [members, balances] = await Promise.all([leaveMembers(ctx), leaveBalances(ctx, year, today)]);
  return (
    <>
      <PageHeader title={`Soldes ${year}`} description="Jours de congé par an de chacun. Seuls les « Congés » sont décomptés, en jours ouvrables (sans week-ends ni jours fériés belges)." />
      <Card key={year}>
        <AllowanceTable year={year} members={members} balances={balances} />
      </Card>
      <p className="mt-3 text-sm text-muted">
        <a className="font-medium text-accent hover:text-accent-hover" href={`/app/conges/soldes?annee=${year - 1}`}>← {year - 1}</a>
        <span className="mx-3">·</span>
        <a className="font-medium text-accent hover:text-accent-hover" href={`/app/conges/soldes?annee=${year + 1}`}>{year + 1} →</a>
      </p>
    </>
  );
}

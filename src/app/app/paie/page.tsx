import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PayrollBoard } from "@/components/payroll/payroll-board";
import { PageHeader } from "@/components/ui/page-header";
import { isMonth } from "@/lib/payroll";
import { todayIn } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { payrollMonth, payrollRights } from "@/server/payroll";

export const metadata: Metadata = { title: "Paie" };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const ctx = await requireContext();
  if (!payrollRights(ctx).manage) redirect("/app/acces-refuse");
  const q = (await searchParams).mois;
  const month = isMonth(q) ? q : todayIn(ctx.business.timezone).slice(0, 7);
  const data = await payrollMonth(ctx.business.id, month);
  return (
    <>
      <PageHeader title="Paie" description="Les prestations du mois, prêtes pour votre secrétariat social : heures du Planning, absences, chèques-repas, primes." />
      <PayrollBoard month={month} rows={data.rows} closedAt={data.closedAt?.toISOString() ?? null} />
    </>
  );
}

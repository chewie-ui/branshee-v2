import type { Metadata } from "next";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { ExpensesBoard } from "@/components/expenses/expenses-board";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { getSellerSettings } from "@/server/invoicing";

export const metadata: Metadata = { title: "Dépenses" };

const todayIn = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const ctx = await requireContext("invoices.view");
  const today = todayIn(ctx.business.timezone || "Europe/Brussels");
  const current = Number(today.slice(0, 4));
  const q = Number((await searchParams).annee);
  const year = q >= 2000 && q <= 2100 ? q : current;
  const [rows, [span], seller] = await Promise.all([
    db.select().from(expenses).where(and(eq(expenses.businessId, ctx.business.id), gte(expenses.date, `${year}-01-01`), lte(expenses.date, `${year}-12-31`))).orderBy(desc(expenses.date), desc(expenses.createdAt)).limit(2000),
    db.select({ first: sql<string | null>`min(${expenses.date})::text` }).from(expenses).where(eq(expenses.businessId, ctx.business.id)),
    getSellerSettings(ctx.business.id),
  ]);
  const from = Math.min(span?.first ? Number(span.first.slice(0, 4)) : current, year, current);
  const years = Array.from({ length: Math.max(year, current) - from + 1 }, (_, i) => from + i).slice(-5);
  return (
    <>
      <PageHeader title="Dépenses" description="Vos achats et frais professionnels, avec leurs justificatifs." />
      <ExpensesBoard
        year={year}
        years={years}
        today={today}
        franchise={seller.vatRegime === "franchise"}
        canManage={ctx.can("invoices.manage")}
        rows={rows.map((r) => ({ id: r.id, date: r.date, supplier: r.supplier, category: r.category, description: r.description, amountCents: r.amountCents, vatCents: r.vatCents, proofName: r.proofName, hasProof: !!r.proofRef }))}
      />
    </>
  );
}

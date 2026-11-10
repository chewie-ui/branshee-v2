import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DocList } from "@/components/invoicing/doc-list";
import { todayIso } from "@/lib/invoicing";
import { requireContext } from "@/server/context";
import { customerOptions, listDocuments } from "@/server/invoicing";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Factures");

const FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "draft", label: "Brouillons" },
  { key: "open", label: "À encaisser" },
  { key: "overdue", label: "En retard" },
  { key: "paid", label: "Payées" },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const t = await appT();
  const ctx = await requireContext("invoices.view");
  const f = (await searchParams).f ?? "all";
  const [docs, customers] = await Promise.all([listDocuments(ctx.business.id, ["invoice", "credit"]), customerOptions(ctx.business.id)]);
  const canManage = ctx.can("invoices.manage");
  return (
    <>
      <PageHeader title={t("Factures")} description={t("Factures et notes de crédit, numérotées dans l'ordre.")} action={canManage ? <ButtonLink href="/app/factures/nouvelle?type=facture" icon={<Plus className="size-4" aria-hidden="true" />}>{t("Nouvelle facture")}</ButtonLink> : undefined} />
      <DocList docs={docs} today={todayIso(ctx.business.timezone)} quotes={false} filter={FILTERS.some((x) => x.key === f) ? f : "all"} filters={FILTERS} names={new Map(customers.map((c) => [c.id, c.company || c.name]))} canManage={canManage} />
    </>
  );
}

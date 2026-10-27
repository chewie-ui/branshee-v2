import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DocList } from "@/components/invoicing/doc-list";
import { todayIso } from "@/lib/invoicing";
import { requireContext } from "@/server/context";
import { customerOptions, listDocuments } from "@/server/invoicing";

export const metadata: Metadata = { title: "Devis" };

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "draft", label: "Brouillons" },
  { key: "sent", label: "Envoyés" },
  { key: "accepted", label: "Acceptés" },
  { key: "expired", label: "Expirés" },
  { key: "invoiced", label: "Facturés" },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const ctx = await requireContext("invoices.view");
  const f = (await searchParams).f ?? "all";
  const [docs, customers] = await Promise.all([listDocuments(ctx.business.id, ["quote"]), customerOptions(ctx.business.id)]);
  const canManage = ctx.can("invoices.manage");
  return (
    <>
      <PageHeader title="Devis" description="Quand le client accepte, transformez le devis en facture en un clic." action={canManage ? <ButtonLink href="/app/factures/nouvelle?type=devis" icon={<Plus className="size-4" aria-hidden="true" />}>Nouveau devis</ButtonLink> : undefined} />
      <DocList docs={docs} today={todayIso(ctx.business.timezone)} quotes filter={FILTERS.some((x) => x.key === f) ? f : "all"} filters={FILTERS} names={new Map(customers.map((c) => [c.id, c.company || c.name]))} canManage={canManage} />
    </>
  );
}

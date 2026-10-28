import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImportWizard } from "@/components/import/import-wizard";
import { clientWord } from "@/lib/terminology";
import { currentBrand } from "@/server/brand";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Importer des fiches" };

/** Import de clients depuis un autre logiciel (Skydev). */
export default async function ImportCustomersPage() {
  const ctx = await requireContext("customers.manage");
  if ((await currentBrand()).id !== "skydev") notFound();
  const one = clientWord(ctx.business.businessType);
  const many = clientWord(ctx.business.businessType, { plural: true });
  return <ImportWizard kind="clients" title={`Importer des ${many}`} backHref="/app/clients" doneHref="/app/clients" noun={{ one, many }} />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ImportWizard } from "@/components/import/import-wizard";
import { requireContext } from "@/server/context";
import { salesRights } from "@/server/sales";

export const metadata: Metadata = { title: "Importer des prospects" };

export default async function Page() {
  const ctx = await requireContext(undefined, { app: "ventes" });
  if (!salesRights(ctx).manage) redirect("/app/ventes/prospection");
  return <ImportWizard kind="prospects" title="Importer des prospects" backHref="/app/ventes/prospection" doneHref="/app/ventes/prospection" noun={{ one: "prospect", many: "prospects" }} />;
}

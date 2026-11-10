import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ImportWizard } from "@/components/import/import-wizard";
import { requireContext } from "@/server/context";
import { salesRights } from "@/server/sales";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Importer des prospects");

export default async function Page() {
  const t = await appT();
  const ctx = await requireContext(undefined, { app: "ventes" });
  if (!salesRights(ctx).manage) redirect("/app/ventes/prospection");
  return <ImportWizard kind="prospects" title={t("Importer des prospects")} backHref="/app/ventes/prospection" doneHref="/app/ventes/prospection" noun={{ one: "prospect", many: "prospects" }} />;
}

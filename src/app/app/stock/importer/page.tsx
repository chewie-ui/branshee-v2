import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ImportWizard } from "@/components/import/import-wizard";
import { requireContext } from "@/server/context";
import { stockRights } from "@/server/stock";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("Importer des produits");

/** Import du catalogue produits (prix, TVA, stock, codes-barres) depuis un fichier. */
export default async function ImportProductsPage() {
  const ctx = await requireContext();
  if (!stockRights(ctx).manage) redirect("/app/stock");
  return <ImportWizard kind="produits" title="Importer des produits" backHref="/app/stock" doneHref="/app/stock" noun={{ one: "produit", many: "produits" }} />;
}

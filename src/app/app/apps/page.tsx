import type { Metadata } from "next";
import { AppLauncher } from "@/components/apps/app-launcher";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Toutes les apps" };

export default async function Page() {
  await requireContext();
  return (
    <>
      <PageHeader title="Toutes les apps" description="Un seul abonnement donne accès à toutes les apps incluses. Les options s'ajoutent quand vous en avez besoin." />
      <AppLauncher />
    </>
  );
}

import type { Metadata } from "next";
import { GradeForm } from "@/components/team/grade-form";
import { PageHeader } from "@/components/ui/page-header";
import { NO_PERMISSIONS } from "@/lib/permissions";
import { requireContext } from "@/server/context";
import { currentBrand } from "@/server/brand";
import { APPS } from "@/lib/apps";

export const metadata: Metadata = { title: "Nouveau grade" };

export default async function NewGradePage() {
  await requireContext("grades.manage");
  // Skydev : choix des apps du grade.
  const apps = (await currentBrand()).id === "skydev" ? APPS.filter((a) => a.id !== "reglages" && a.status === "active").map((a) => ({ id: a.id, name: a.name })) : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nouveau grade" />
      <GradeForm id={null} name="" permissions={NO_PERMISSIONS} isBuiltIn={false} apps={apps} />
    </div>
  );
}

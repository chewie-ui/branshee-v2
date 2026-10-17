import type { Metadata } from "next";
import { GradeForm } from "@/components/team/grade-form";
import { PageHeader } from "@/components/ui/page-header";
import { NO_PERMISSIONS } from "@/lib/permissions";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Nouveau grade" };

export default async function NewGradePage() {
  await requireContext("grades.manage");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nouveau grade" />
      <GradeForm id={null} name="" permissions={NO_PERMISSIONS} isBuiltIn={false} />
    </div>
  );
}

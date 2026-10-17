import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { grades } from "@/db/schema";
import { AddMemberForm } from "@/components/team/member-forms";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Ajouter un membre" };

export default async function AddMemberPage() {
  const ctx = await requireContext("team.manage");
  const list = await db.select({ id: grades.id, name: grades.name }).from(grades).where(eq(grades.businessId, ctx.business.id)).orderBy(asc(grades.createdAt));
  const fallback = list.find((g) => g.name === "Collaborateur") ?? list[0];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Ajouter un membre" description="Un praticien, un associé, un employé…" />
      <AddMemberForm grades={list} defaultGradeId={fallback?.id ?? ""} />
    </div>
  );
}

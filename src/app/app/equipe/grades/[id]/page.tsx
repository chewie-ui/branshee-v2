import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { grades } from "@/db/schema";
import { GradeForm } from "@/components/team/grade-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { currentBrand } from "@/server/brand";
import { APPS } from "@/lib/apps";

export const metadata: Metadata = { title: "Modifier le grade" };

export default async function EditGradePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("grades.manage");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [g] = await db.select().from(grades).where(and(eq(grades.id, id.data), eq(grades.businessId, ctx.business.id)));
  if (!g) notFound();
  // Skydev : choix des apps du grade.
  const apps = (await currentBrand()).id === "skydev" ? APPS.filter((a) => a.id !== "reglages" && a.status === "active").map((a) => ({ id: a.id, name: a.name })) : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/equipe/grades" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Grades
      </Link>
      <PageHeader title={g.name} />
      <GradeForm id={g.id} name={g.name} permissions={g.permissions} isBuiltIn={g.isBuiltIn} apps={apps} appAccess={g.appAccess ?? null} />
    </div>
  );
}

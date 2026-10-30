import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { and, asc, eq } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { grades, members } from "@/db/schema";
import { EditMemberForm } from "@/components/team/member-forms";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Membre de l'équipe" };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("team.manage");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [m] = await db.select().from(members).where(and(eq(members.id, id.data), eq(members.businessId, ctx.business.id)));
  if (!m) notFound();
  const list = await db.select({ id: grades.id, name: grades.name }).from(grades).where(eq(grades.businessId, ctx.business.id)).orderBy(asc(grades.createdAt));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/equipe" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Équipe
      </Link>
      <PageHeader title={m.displayName} description={m.status === "invited" ? `Invitation en attente : ${m.inviteEmail}` : undefined} />
      <EditMemberForm
        grades={list}
        m={{
          id: m.id,
          displayName: m.displayName,
          roleLabel: m.roleLabel ?? "",
          bio: m.bio ?? "",
          customInfo: m.customInfo.map((c) => `${c.label} : ${c.value}`).join("\n"),
          showRole: m.showRole,
          gradeId: m.gradeId ?? "",
          isBookable: m.isBookable,
          isActive: m.isActive,
          isOwner: m.isOwner,
          timeOff: m.canManageOwnTimeOff == null ? "inherit" : m.canManageOwnTimeOff ? "yes" : "no",
          isSelf: m.id === ctx.member.id,
        }}
      />
    </div>
  );
}

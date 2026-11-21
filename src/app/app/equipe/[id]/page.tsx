import { memberPhotoSql } from "@/server/member-photo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { and, asc, eq } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { grades, members, users } from "@/db/schema";
import { EditMemberForm } from "@/components/team/member-forms";
import { MemberAccess, type MemberAccessState } from "@/components/team/member-access";
import { currentBrand } from "@/server/brand";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Membre de l'équipe");

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await appT();
  const ctx = await requireContext("team.manage");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [row] = await db.select({ m: members, photo: memberPhotoSql }).from(members).where(and(eq(members.id, id.data), eq(members.businessId, ctx.business.id)));
  if (!row) notFound();
  const m = row.m;
  const [acct] = m.userId ? await db.select({ email: users.email }).from(users).where(eq(users.id, m.userId)) : [];
  const access: MemberAccessState =
    m.status === "invited" ? { kind: "invited", email: m.inviteEmail ?? acct?.email ?? "" } : acct ? { kind: "account", email: acct.email } : m.inviteEmail ? { kind: "pending", email: m.inviteEmail } : { kind: "none" };
  const brand = (await currentBrand()).name;
  const list = await db.select({ id: grades.id, name: grades.name }).from(grades).where(eq(grades.businessId, ctx.business.id)).orderBy(asc(grades.createdAt));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/equipe" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("Équipe")}
      </Link>
      <PageHeader title={m.displayName} description={m.status === "invited" ? `Invitation en attente : ${m.inviteEmail}` : undefined} />
      {!m.isOwner ? <MemberAccess memberId={m.id} name={m.displayName} state={access} brand={brand} /> : null}
      <EditMemberForm
        grades={list}
        m={{
          id: m.id,
          displayName: m.displayName,
          photo: row.photo,
          ownPhoto: !!m.photoUrl,
          roleLabel: m.roleLabel ?? "",
          bio: m.bio ?? "",
          customInfo: m.customInfo.map((c) => `${t(c.label)} : ${c.value}`).join("\n"),
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

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { grades, members } from "@/db/schema";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { requireContext } from "@/server/context";
import { JoinRequestButtons } from "@/components/memberships/membership-actions";
import { CardHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Équipe" };

export default async function TeamPage() {
  const ctx = await requireContext("team.view");
  const canManage = ctx.can("team.manage");
  const rows = await db
    .select({ m: members, gradeName: grades.name })
    .from(members)
    .leftJoin(grades, eq(grades.id, members.gradeId))
    .where(and(eq(members.businessId, ctx.business.id), inArray(members.status, ["active", "invited"])))
    .orderBy(asc(members.createdAt));
  const requests = canManage ? await db.select().from(members).where(and(eq(members.businessId, ctx.business.id), eq(members.status, "requested"))).orderBy(asc(members.createdAt)) : [];

  return (
    <>
      <PageHeader
        title="Équipe"
        description={`${rows.length} membre${rows.length > 1 ? "s" : ""}`}
        action={canManage ? <ButtonLink href="/app/equipe/ajouter" data-tour="add-member" icon={<Plus className="size-4" aria-hidden="true" />}>Ajouter un membre</ButtonLink> : null}
      />
      {ctx.can("grades.view") ? <Tabs items={[{ href: "/app/equipe", label: "Membres" }, { href: "/app/equipe/grades", label: "Grades et permissions" }]} /> : null}
      {requests.length ? (
        <Card className="mb-6">
          <CardHeader title="Demandes pour rejoindre l'équipe" description="Ces personnes ont un compte Branshee et souhaitent rejoindre votre établissement." />
          <ul className="divide-y divide-border">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Avatar name={r.displayName} src={r.photoUrl} />
                <span className="min-w-0 flex-1 font-medium">{r.displayName}</span>
                <JoinRequestButtons memberId={r.id} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {rows.map(({ m, gradeName }) => {
            const content = (
              <>
                <Avatar name={m.displayName} src={m.photoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {m.displayName}
                    {m.id === ctx.member.id ? <span className="text-sm font-normal text-muted">(vous)</span> : null}
                  </p>
                  <p className="truncate text-sm text-muted">{m.roleLabel ?? (m.inviteEmail && !m.userId ? m.inviteEmail : "—")}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {m.isOwner ? <Badge tone="accent">Propriétaire</Badge> : gradeName ? <Badge>{gradeName}</Badge> : null}
                  {m.status === "invited" ? <Badge tone="warning">Invitation en attente</Badge> : null}
                  {!m.isActive ? <Badge tone="danger">Désactivé</Badge> : null}
                  {!m.isBookable ? <Badge>Non réservable</Badge> : null}
                </div>
                {canManage ? <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" /> : null}
              </>
            );
            return (
              <li key={m.id}>
                {canManage ? (
                  <Link href={`/app/equipe/${m.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-muted/60">{content}</Link>
                ) : (
                  <div className="flex items-center gap-4 px-5 py-4">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}

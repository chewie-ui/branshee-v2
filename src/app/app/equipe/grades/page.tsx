import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { grades, members } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { PERMISSIONS } from "@/lib/permissions";
import { requireContext } from "@/server/context";
import { businessHas } from "@/server/plan";
import { UpgradeNotice } from "@/components/app/upgrade-notice";

export const metadata: Metadata = { title: "Grades et permissions" };

const TOTAL = Object.values(PERMISSIONS).reduce((n, d) => n + Object.keys(d.actions).length, 0);

export default async function GradesPage() {
  const ctx = await requireContext("grades.view");
  const allowed = await businessHas(ctx.business.id, "grades");
  const canManage = ctx.can("grades.manage") && allowed;
  const rows = await db
    .select({ g: grades, n: count(members.id) })
    .from(grades)
    .leftJoin(members, eq(members.gradeId, grades.id))
    .where(eq(grades.businessId, ctx.business.id))
    .groupBy(grades.id)
    .orderBy(asc(grades.createdAt));

  return (
    <>
      <PageHeader
        title="Équipe"
        description="Un grade regroupe des permissions. Chaque membre a un grade."
        action={canManage ? <ButtonLink href="/app/equipe/grades/nouveau" icon={<Plus className="size-4" aria-hidden="true" />}>Nouveau grade</ButtonLink> : null}
      />
      <Tabs items={[{ href: "/app/equipe", label: "Membres" }, { href: "/app/equipe/grades", label: "Grades et permissions" }]} />
      {!allowed ? <div className="mb-4"><UpgradeNotice feature="Grades sur mesure" required="pro_plus">Les grades intégrés restent appliqués. Créer et modifier des grades est inclus dans le forfait Pro+.</UpgradeNotice></div> : null}
      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {rows.map(({ g, n }) => {
            const granted = Object.values(g.permissions as Record<string, Record<string, boolean>>).reduce((sum, d) => sum + Object.values(d).filter(Boolean).length, 0);
            const inner = (
              <>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    {g.name}
                    {g.isBuiltIn ? <Badge>Intégré</Badge> : null}
                  </p>
                  <p className="text-sm text-muted">{granted} permission{granted > 1 ? "s" : ""} sur {TOTAL} · {n} membre{n > 1 ? "s" : ""}</p>
                </div>
                {canManage ? <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" /> : null}
              </>
            );
            return (
              <li key={g.id}>
                {canManage ? <Link href={`/app/equipe/grades/${g.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/60">{inner}</Link> : <div className="flex items-center gap-4 px-5 py-4">{inner}</div>}
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="mt-3 text-sm text-muted">Le propriétaire de l&apos;établissement a toujours accès à tout, quel que soit le grade.</p>
    </>
  );
}

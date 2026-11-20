import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { grades } from "@/db/schema";
import { AddMemberForm } from "@/components/team/member-forms";
import { TeamPriceNotice } from "@/components/team/team-price-notice";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";
import { collaboratorUsage } from "@/server/plan";
import { ButtonLink } from "@/components/ui/button";

export const generateMetadata = appMetadata("Ajouter un membre");

export default async function AddMemberPage() {
  const t = await appT();
  const ctx = await requireContext("team.manage");
  const list = await db.select({ id: grades.id, name: grades.name }).from(grades).where(eq(grades.businessId, ctx.business.id)).orderBy(asc(grades.createdAt));
  const fallback = list.find((g) => g.name === "Collaborateur") ?? list[0];
  // Essai gratuit : pas d'ajout sans abonnement (chaque personne est facturée).
  const seats = await collaboratorUsage(ctx.business.id);
  const blocked = seats.trial && seats.used >= seats.max;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("Ajouter un membre")} description={t("Un praticien, un associé, un employé…")} />
      <TeamPriceNotice businessId={ctx.business.id} />
      {blocked ? (
        <ButtonLink href="/app/reglages/abonnement">{t("S'abonner")}</ButtonLink>
      ) : (
        <AddMemberForm grades={list} defaultGradeId={fallback?.id ?? ""} />
      )}
    </div>
  );
}

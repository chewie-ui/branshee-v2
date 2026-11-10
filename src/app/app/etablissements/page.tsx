import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { InvitationsAndJoin, MyBusinesses } from "@/components/memberships/memberships-panel";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { listMemberships } from "@/server/memberships";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Mes établissements");

export default async function BusinessesPage() {
  const t = await appT();
  const ctx = await requireContext();
  const rows = await listMemberships(ctx.user.id);
  return (
    <>
      <PageHeader title={t("Mes établissements")} description={t("Ceux que vous gérez ou dont vous faites partie.")} action={<ButtonLink href="/bienvenue" icon={<Plus className="size-4" aria-hidden="true" />}>{t("Créer un établissement")}</ButtonLink>} />
      <div className="mx-auto max-w-3xl space-y-6">
        <MyBusinesses rows={rows} userId={ctx.user.id} />
        <InvitationsAndJoin rows={rows} />
      </div>
    </>
  );
}

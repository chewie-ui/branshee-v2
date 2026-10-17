import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { InvitationsAndJoin, MyBusinesses } from "@/components/memberships/memberships-panel";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { listMemberships } from "@/server/memberships";

export const metadata: Metadata = { title: "Mes établissements" };

export default async function BusinessesPage() {
  const ctx = await requireContext();
  const rows = await listMemberships(ctx.user.id);
  return (
    <>
      <PageHeader title="Mes établissements" description="Ceux que vous gérez ou dont vous faites partie." action={<ButtonLink href="/bienvenue" icon={<Plus className="size-4" aria-hidden="true" />}>Créer un établissement</ButtonLink>} />
      <div className="mx-auto max-w-3xl space-y-6">
        <MyBusinesses rows={rows} userId={ctx.user.id} />
        <InvitationsAndJoin rows={rows} />
      </div>
    </>
  );
}

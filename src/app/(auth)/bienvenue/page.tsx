import type { Metadata } from "next";
import { CreateBusinessForm } from "@/components/auth/create-business-form";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/context";
import { InvitationsAndJoin } from "@/components/memberships/memberships-panel";
import { listMemberships } from "@/server/memberships";
import { professionList } from "@/server/site";

export const metadata: Metadata = { title: "Bienvenue" };
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await requireUser();
  const [rows, professions] = await Promise.all([listMemberships(user.id), professionList()]);
  const invited = rows.some((r) => r.status === "invited");
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">Bienvenue {user.name.split(" ")[0]}</h1>
      <p className="mt-1 text-center text-sm text-muted">Créons votre établissement. Tout se modifie ensuite.</p>
      {invited ? <div className="mt-6"><InvitationsAndJoin rows={rows.filter((r) => r.status !== "active")} /></div> : null}
      <Card className="mt-6 p-6">
        <CreateBusinessForm professions={professions} />
      </Card>
      {!invited ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-center text-sm font-medium text-accent">Vous rejoignez un établissement existant ?</summary>
          <div className="mt-4"><InvitationsAndJoin rows={rows.filter((r) => r.status !== "active")} /></div>
        </details>
      ) : null}
    </>
  );
}

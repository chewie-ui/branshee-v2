import type { Metadata } from "next";
import { CreateBusinessForm } from "@/components/auth/create-business-form";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/context";

export const metadata: Metadata = { title: "Bienvenue" };
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await requireUser();
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">Bienvenue {user.name.split(" ")[0]}</h1>
      <p className="mt-1 text-center text-sm text-muted">Créons votre établissement. Tout se modifie ensuite.</p>
      <Card className="mt-6 p-6">
        <CreateBusinessForm />
      </Card>
    </>
  );
}

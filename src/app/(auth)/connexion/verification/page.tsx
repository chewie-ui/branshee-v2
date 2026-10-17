import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { Card } from "@/components/ui/card";
import { getPendingTwoFactor } from "@/server/auth/session";

export const metadata: Metadata = { title: "Vérification en deux étapes" };
export const dynamic = "force-dynamic";

export default async function TwoFactorPage() {
  if (!(await getPendingTwoFactor())) redirect("/connexion");
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">Vérification en deux étapes</h1>
      <p className="mt-1 text-center text-sm text-muted">Saisissez le code à 6 chiffres affiché dans votre application d&apos;authentification.</p>
      <Card className="mt-6 p-6">
        <TwoFactorForm />
      </Card>
      <p className="mt-6 text-center text-sm">
        <Link href="/connexion" className="font-medium text-accent hover:text-accent-hover">Retour à la connexion</Link>
      </p>
    </>
  );
}

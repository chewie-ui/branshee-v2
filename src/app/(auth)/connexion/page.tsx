import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  if (await getSessionUser()) redirect("/app");
  const { suite } = await searchParams;
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">Bon retour</h1>
      <p className="mt-1 text-center text-sm text-muted">Connectez-vous à votre espace.</p>
      <Card className="mt-6 p-6">
        <LoginForm next={suite} />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-medium text-accent hover:text-accent-hover">
          Créer un compte
        </Link>
      </p>
    </>
  );
}

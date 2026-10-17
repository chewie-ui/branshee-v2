import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Créer un compte" };

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getSessionUser()) redirect("/app");
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">Créer votre compte</h1>
      <p className="mt-1 text-center text-sm text-muted">Vos clients réservent en ligne, vous gardez la main.</p>
      <Card className="mt-6 p-6">
        <RegisterForm />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="font-medium text-accent hover:text-accent-hover">
          Se connecter
        </Link>
      </p>
    </>
  );
}

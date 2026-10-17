import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/auth/reset-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">Mot de passe oublié</h1>
      <p className="mt-1 text-center text-sm text-muted">Recevez un code par email pour en choisir un nouveau.</p>
      <Card className="mt-6 p-6">
        <ResetForm />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/connexion" className="font-medium text-accent hover:text-accent-hover">
          Retour à la connexion
        </Link>
      </p>
    </>
  );
}

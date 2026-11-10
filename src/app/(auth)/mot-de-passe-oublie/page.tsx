import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/auth/reset-form";
import { Card } from "@/components/ui/card";
import { localize } from "@/lib/site-locale";
import { siteLocale } from "@/server/site-locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await siteLocale()) === "en" ? "Forgot your password" : "Mot de passe oublié" };
}

export default async function ForgotPasswordPage() {
  const l = await siteLocale();
  const en = l === "en";
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">{en ? "Forgot your password" : "Mot de passe oublié"}</h1>
      <p className="mt-1 text-center text-sm text-muted">{en ? "Get a code by email to choose a new one." : "Recevez un code par email pour en choisir un nouveau."}</p>
      <Card className="mt-6 p-6">
        <ResetForm locale={l} />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href={localize("/connexion", l)} className="font-medium text-accent hover:text-accent-hover">
          {en ? "Back to log in" : "Retour à la connexion"}
        </Link>
      </p>
    </>
  );
}

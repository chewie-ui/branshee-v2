import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/server/auth/session";
import { isPro } from "@/server/client-account";
import { GoogleButton } from "@/components/auth/google-button";
import { googleConfigured } from "@/server/google";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

const internal = (s?: string) => (s && s.startsWith("/") && !s.startsWith("//") ? s : undefined);

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string; google?: string }> }) {
  const { suite, google } = await searchParams;
  const s = await getSessionUser();
  if (s) redirect(internal(suite) ?? ((await isPro(s.user.id)) ? "/app" : "/espace-client"));
  const clientFlow = !!suite && !suite.startsWith("/app");
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">Bon retour</h1>
      <p className="mt-1 text-center text-sm text-muted">{clientFlow ? "Connectez-vous pour retrouver vos rendez-vous." : "Connectez-vous à votre espace."}</p>
      {google ? <p className="mt-4 rounded-lg bg-warning-soft p-3 text-sm text-warning" role="alert">{google === "desactive" ? "Ce compte est désactivé." : google === "email-non-verifie" ? "Votre adresse Google n'est pas vérifiée." : "La connexion avec Google n'a pas abouti. Réessayez."}</p> : null}
      <Card className="mt-6 p-6">
        {googleConfigured() ? <GoogleButton suite={suite} /> : null}
        <LoginForm next={suite} />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href={clientFlow ? `/inscription?client=1&suite=${encodeURIComponent(suite!)}` : "/inscription"} className="font-medium text-accent hover:text-accent-hover">
          Créer un compte
        </Link>
      </p>
    </>
  );
}

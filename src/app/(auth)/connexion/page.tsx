import type { Metadata } from "next";
import { FeatureStatusPage } from "@/components/feature-status";
import { featureStatus } from "@/server/features";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/server/auth/session";
import { isPro } from "@/server/client-account";
import { GoogleButton } from "@/components/auth/google-button";
import { googleConfigured } from "@/server/google";
import { safeInternalPath } from "@/lib/safe-path";
import { localize } from "@/lib/site-locale";
import { siteLocale } from "@/server/site-locale";

export async function generateMetadata(): Promise<Metadata> {
  const l = await siteLocale();
  return { title: l === "en" ? "Log in" : "Connexion", alternates: { languages: { fr: "/connexion", en: "/en/login" } } };
}
export const dynamic = "force-dynamic";

const internal = safeInternalPath;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string; google?: string; reinitialise?: string }> }) {
  const gate = await featureStatus("login");
  if (gate.status !== "active") return <FeatureStatusPage status={gate.status} message={gate.message} />;
  const { suite, google, reinitialise } = await searchParams;
  const s = await getSessionUser();
  if (s && !s.user.isDemo) redirect(internal(suite) ?? ((await isPro(s.user.id)) ? "/app" : "/espace-client"));
  const clientFlow = !!suite && !suite.startsWith("/app");
  const en = (await siteLocale()) === "en";
  const l = en ? "en" : "fr";
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">{en ? "Welcome back" : "Bon retour"}</h1>
      <p className="mt-1 text-center text-sm text-muted">{en ? (clientFlow ? "Log in to see your appointments." : "Log in to your space.") : clientFlow ? "Connectez-vous pour retrouver vos rendez-vous." : "Connectez-vous à votre espace."}</p>
      {reinitialise ? <p className="mt-4 rounded-lg bg-success-soft p-3 text-sm text-success" role="status">{en ? "Password changed. Log in with your new password, then the code from your authenticator app." : "Mot de passe modifié. Connectez-vous avec le nouveau mot de passe, puis le code de votre application d'authentification."}</p> : null}
      {google ? <p className="mt-4 rounded-lg bg-warning-soft p-3 text-sm text-warning" role="alert">{google === "desactive" ? (en ? "This account is disabled." : "Ce compte est désactivé.") : google === "email-non-verifie" ? (en ? "Your Google address isn't verified." : "Votre adresse Google n'est pas vérifiée.") : en ? "Google sign-in didn't go through. Try again." : "La connexion avec Google n'a pas abouti. Réessayez."}</p> : null}
      <Card className="mt-6 p-6">
        {googleConfigured() ? <GoogleButton suite={suite} locale={l} /> : null}
        <LoginForm next={suite} locale={l} />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        {en ? "No account yet?" : "Pas encore de compte ?"}{" "}
        <Link href={localize(clientFlow ? `/inscription?client=1&suite=${encodeURIComponent(suite!)}` : "/inscription", l)} className="font-medium text-accent hover:text-accent-hover">
          {en ? "Create an account" : "Créer un compte"}
        </Link>
      </p>
    </>
  );
}

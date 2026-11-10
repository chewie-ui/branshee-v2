import type { Metadata } from "next";
import { FeatureStatusPage } from "@/components/feature-status";
import { featureStatus } from "@/server/features";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/server/auth/session";
import { GoogleButton } from "@/components/auth/google-button";
import { googleConfigured } from "@/server/google";
import { currentBrand } from "@/server/brand";
import { localize } from "@/lib/site-locale";
import { siteLocale } from "@/server/site-locale";

export async function generateMetadata(): Promise<Metadata> {
  const l = await siteLocale();
  return { title: l === "en" ? "Create an account" : "Créer un compte", alternates: { languages: { fr: "/inscription", en: "/en/signup" } } };
}
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ client?: string; suite?: string; email?: string; nom?: string; ref?: string; demo?: string }> }) {
  const gate = await featureStatus("register");
  if (gate.status !== "active") return <FeatureStatusPage status={gate.status} message={gate.message} />;
  const sp = await searchParams;
  const client = sp.client === "1";
  const session = await getSessionUser();
  // Visiteur de la démo : il peut créer son vrai compte (la démo ne s'enregistre pas).
  if (session && !session.user.isDemo) redirect(client ? "/espace-client" : "/app");
  const brand = await currentBrand();
  const l = await siteLocale();
  const en = l === "en";
  const L = (h: string) => localize(h, l);
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">{en ? (client ? "Create your client account" : "Create your account") : client ? "Créer votre compte client" : "Créer votre compte"}</h1>
      <p className="mt-1 text-center text-sm text-muted">{en ? (client ? "Find, move or cancel your appointments in one click." : "All your business apps, in one space.") : client ? "Retrouvez, déplacez ou annulez vos rendez-vous en un clic." : brand.id === "skydev" ? "Toutes les apps de votre entreprise, dans un seul espace." : "Vos clients réservent en ligne, vous gardez la main."}</p>
      {brand.id === "skydev" && !sp.ref ? (
        <nav aria-label={en ? "Account type" : "Type de compte"} className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
          {[
            { href: L(sp.suite ? `/inscription?suite=${encodeURIComponent(sp.suite)}` : "/inscription"), on: !client, title: en ? "Business" : "Entreprise", text: en ? "Run my business" : "Gérer mon activité" },
            { href: L(`/inscription?client=1${sp.suite ? `&suite=${encodeURIComponent(sp.suite)}` : ""}`), on: client, title: en ? "Individual" : "Particulier", text: en ? "Follow my appointments" : "Suivre mes rendez-vous" },
          ].map((t) => (
            <Link key={t.title} href={t.href} aria-current={t.on ? "page" : undefined} className={`rounded-lg px-3 py-2.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-accent ${t.on ? "bg-surface shadow-sm" : "text-muted hover:text-text"}`}>
              <span className="block text-sm font-semibold">{t.title}</span>
              <span className="block text-xs text-muted">{t.text}</span>
            </Link>
          ))}
        </nav>
      ) : null}
      {sp.demo ? <p className="mt-4 rounded-lg bg-accent-soft p-3 text-center text-sm text-accent-soft-foreground" role="status">{en ? "This part (account, subscription, team) isn't available in the demo. Create your free account to start with your own data: 30-day trial, no card." : "Cette partie (compte, abonnement, équipe) n'est pas disponible dans la démo. Créez votre compte gratuit pour commencer avec vos propres données : 30 jours d'essai, sans carte."}</p> : null}
      {sp.ref ? <p className="mt-4 rounded-lg bg-accent-soft p-3 text-center text-sm text-accent-soft-foreground">{en ? `You were invited by a business already on ${brand.name}. Create your business space: free trial, no card.` : `Vous êtes invité par un professionnel déjà sur ${brand.name}. Créez votre espace entreprise : essai gratuit, sans carte.`}</p> : null}
      <Card className="mt-6 p-6">
        {googleConfigured() ? <GoogleButton suite={sp.ref ? undefined : (sp.suite ?? (client ? "/espace-client" : undefined))} refCode={sp.ref?.slice(0, 40)} label={en ? "Sign up with Google" : "S'inscrire avec Google"} locale={l} /> : null}
        <RegisterForm client={client} next={sp.suite} refCode={sp.ref?.slice(0, 40)} defaults={{ email: sp.email?.slice(0, 200), fullName: sp.nom?.slice(0, 120) }} locale={l} />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        {en ? "Already have an account?" : "Déjà un compte ?"}{" "}
        <Link href={L(sp.suite ? `/connexion?suite=${encodeURIComponent(sp.suite)}` : "/connexion")} className="font-medium text-accent hover:text-accent-hover">
          {en ? "Log in" : "Se connecter"}
        </Link>
      </p>
      {!client && brand.id !== "skydev" ? (
        <p className="mt-2 text-center text-sm text-muted">
          Vous voulez juste prendre rendez-vous ?{" "}
          <Link href="/inscription?client=1" className="font-medium text-accent hover:text-accent-hover">Compte client</Link>
        </p>
      ) : null}
    </>
  );
}

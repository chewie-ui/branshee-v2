import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/server/auth/session";
import { GoogleButton } from "@/components/auth/google-button";
import { googleConfigured } from "@/server/google";

export const metadata: Metadata = { title: "Créer un compte" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ client?: string; suite?: string; email?: string; nom?: string; ref?: string }> }) {
  const sp = await searchParams;
  const client = sp.client === "1";
  if (await getSessionUser()) redirect(client ? "/espace-client" : "/app");
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">{client ? "Créer votre compte client" : "Créer votre compte"}</h1>
      <p className="mt-1 text-center text-sm text-muted">{client ? "Retrouvez, déplacez ou annulez vos rendez-vous en un clic." : "Vos clients réservent en ligne, vous gardez la main."}</p>
      {sp.ref ? <p className="mt-4 rounded-lg bg-accent-soft p-3 text-center text-sm text-accent-soft-foreground">Vous êtes invité par un professionnel déjà sur Branshee.</p> : null}
      <Card className="mt-6 p-6">
        {googleConfigured() && !sp.ref ? <GoogleButton suite={sp.suite ?? (client ? "/espace-client" : undefined)} label="S'inscrire avec Google" /> : null}
        <RegisterForm client={client} next={sp.suite} refCode={sp.ref?.slice(0, 40)} defaults={{ email: sp.email?.slice(0, 200), fullName: sp.nom?.slice(0, 120) }} />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        Déjà un compte ?{" "}
        <Link href={sp.suite ? `/connexion?suite=${encodeURIComponent(sp.suite)}` : "/connexion"} className="font-medium text-accent hover:text-accent-hover">
          Se connecter
        </Link>
      </p>
      {!client ? (
        <p className="mt-2 text-center text-sm text-muted">
          Vous voulez juste prendre rendez-vous ?{" "}
          <Link href="/inscription?client=1" className="font-medium text-accent hover:text-accent-hover">Compte client</Link>
        </p>
      ) : null}
    </>
  );
}

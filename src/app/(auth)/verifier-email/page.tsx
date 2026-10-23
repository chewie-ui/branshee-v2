import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/server/auth/session";
import { safeInternalPath } from "@/lib/safe-path";

export const metadata: Metadata = { title: "Confirmer votre email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  const s = await getSessionUser();
  if (!s) redirect(`/connexion?suite=${encodeURIComponent(`/verifier-email${suite ? `?suite=${encodeURIComponent(suite)}` : ""}`)}`);
  const next = safeInternalPath(suite) ?? "/espace-client";
  if (s.user.emailVerifiedAt) redirect(next);
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">Confirmez votre email</h1>
      <p className="mt-1 text-center text-sm text-muted">Nous avons envoyé un code à 6 chiffres à <span className="font-medium text-text">{s.user.email}</span>.</p>
      <Card className="mt-6 p-6">
        <VerifyEmailForm next={next} />
      </Card>
      {/* Inscription au milieu d'une réservation : le code peut attendre, la réservation non. */}
      {next !== "/espace-client" && !next.startsWith("/app") ? (
        <p className="mt-4 text-center text-sm text-muted">
          <Link href={next} className="font-medium text-accent hover:text-accent-hover">Plus tard — revenir à ma réservation</Link>
        </p>
      ) : null}
    </>
  );
}

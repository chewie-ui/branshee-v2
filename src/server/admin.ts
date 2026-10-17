import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";

/**
 * Accès réservé au super-admin (`users.is_superadmin`).
 * Pour tout autre compte, l'espace admin n'existe pas (404) : on ne révèle pas son adresse.
 */
export async function requireSuperadmin() {
  const session = await getSessionUser();
  if (!session) redirect("/connexion");
  if (!session.user.isSuperadmin) notFound();
  return { id: session.user.id, name: session.user.fullName, email: session.user.email };
}

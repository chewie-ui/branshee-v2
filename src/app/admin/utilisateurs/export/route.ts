import { desc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { csvResponse, toCsv } from "@/server/csv";

/** Export des comptes (identité et activité ; pas de données de santé). */
export async function GET() {
  const s = await getSessionUser();
  if (!s?.user.isSuperadmin || s.impersonatedById) return new Response("Introuvable", { status: 404 });
  const rows = await db
    .select({ name: users.fullName, email: users.email, phone: users.phone, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt, disabledAt: users.disabledAt, verified: users.emailVerifiedAt, referralCode: users.referralCode })
    .from(users)
    .orderBy(desc(users.createdAt));
  const csv = toCsv(
    ["Nom", "Email", "Téléphone", "Inscrit le", "Dernière connexion", "Email vérifié", "Désactivé", "Code parrain"],
    rows
      .filter((r) => !r.email.endsWith("@branshee.invalid"))
      .map((r) => [r.name, r.email, r.phone, r.createdAt.toISOString().slice(0, 10), r.lastLoginAt?.toISOString().slice(0, 10) ?? "", r.verified ? "oui" : "non", r.disabledAt ? "oui" : "non", r.referralCode]),
  );
  return csvResponse(`branshee-utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

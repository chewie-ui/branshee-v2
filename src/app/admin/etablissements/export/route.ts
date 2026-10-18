import { desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, users } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { csvResponse, toCsv } from "@/server/csv";

/** Export des établissements (aucune donnée de clients ni de santé). */
export async function GET() {
  const s = await getSessionUser();
  if (!s?.user.isSuperadmin || s.impersonatedById) return new Response("Introuvable", { status: 404 });
  const rows = await db
    .select({
      name: businesses.name,
      slug: businesses.slug,
      type: businesses.businessType,
      city: businesses.city,
      email: businesses.email,
      phone: businesses.phone,
      owner: users.fullName,
      ownerEmail: users.email,
      createdAt: businesses.createdAt,
      pausedAt: businesses.pausedAt,
      plan: sql<string>`coalesce((select plan::text from business_plans bp where bp.business_id = ${businesses.id}), 'free')`,
      team: sql<number>`(select count(*)::int from members m where m.business_id = ${businesses.id} and m.status = 'active')`,
      appts: sql<number>`(select count(*)::int from appointments a where a.business_id = ${businesses.id} and a.kind = 'appointment')`,
    })
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .where(isNull(businesses.deletedAt))
    .orderBy(desc(businesses.createdAt));
  const csv = toCsv(
    ["Nom", "Adresse", "Métier", "Ville", "Email", "Téléphone", "Propriétaire", "Email propriétaire", "Forfait", "Membres", "RDV", "Créé le", "En pause"],
    rows.map((r) => [r.name, r.slug, r.type, r.city, r.email, r.phone, r.owner, r.ownerEmail, r.plan, r.team, r.appts, r.createdAt.toISOString().slice(0, 10), r.pausedAt ? "oui" : "non"]),
  );
  return csvResponse(`branshee-etablissements-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

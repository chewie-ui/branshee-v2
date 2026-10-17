import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, grades, members } from "@/db/schema";

/** Établissements d'un compte : actifs, invitations reçues, demandes envoyées. */
export async function listMemberships(userId: string) {
  return db
    .select({ memberId: members.id, status: members.status, isOwner: members.isOwner, gradeName: grades.name, business: { id: businesses.id, name: businesses.name, slug: businesses.slug, city: businesses.city, businessType: businesses.businessType, photoUrl: businesses.photoUrl, pausedAt: businesses.pausedAt } })
    .from(members)
    .innerJoin(businesses, eq(businesses.id, members.businessId))
    .leftJoin(grades, eq(grades.id, members.gradeId))
    .where(and(eq(members.userId, userId), inArray(members.status, ["active", "invited", "requested"]), isNull(businesses.deletedAt)))
    .orderBy(asc(businesses.name));
}

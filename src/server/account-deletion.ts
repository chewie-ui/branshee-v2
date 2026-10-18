import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, businesses, users } from "@/db/schema";
import { destroyAllSessions } from "@/server/auth/session";
import { deletePublicImage } from "@/server/storage";

/**
 * Suppression d'un compte (par son titulaire ou par le super-admin).
 * Ses établissements sont supprimés (corbeille) ; s'il en possède, le compte est anonymisé
 * plutôt qu'effacé (les établissements gardent leur propriétaire pour l'historique).
 */
export async function deleteUserAccount(userId: string, actor: { id: string; name: string }, reason = "avec le compte du propriétaire") {
  const [u] = await db.select({ id: users.id, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, userId));
  if (!u) return false;
  const all = await db.select({ id: businesses.id, deletedAt: businesses.deletedAt }).from(businesses).where(eq(businesses.ownerId, userId));
  const owned = all.filter((b) => !b.deletedAt);
  await db.transaction(async (tx) => {
    for (const b of owned) {
      await tx.update(businesses).set({ deletedAt: new Date(), pausedAt: new Date() }).where(eq(businesses.id, b.id));
      await tx.insert(activityLogs).values({ businessId: b.id, userId: actor.id, actorName: actor.name, action: "business.deleted", description: `Établissement supprimé ${reason}` });
    }
    if (all.length) {
      await tx
        .update(users)
        .set({ email: `supprime-${userId}@branshee.invalid`, fullName: "Compte supprimé", passwordHash: null, googleId: null, appleId: null, avatarUrl: null, phone: null, birthDate: null, gender: null, address: null, postalCode: null, city: null, twoFactorSecret: null, disabledAt: new Date() })
        .where(eq(users.id, userId));
    } else {
      await tx.delete(users).where(eq(users.id, userId));
    }
  });
  await destroyAllSessions(userId);
  await deletePublicImage(u.avatarUrl);
  return true;
}

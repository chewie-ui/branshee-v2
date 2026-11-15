import "server-only";
import { lt } from "drizzle-orm";
import { db } from "@/db";
import { errorLogs, loginEvents, pageViews } from "@/db/schema";

const monthsAgo = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d; };

/**
 * Durées de conservation annoncées dans la politique de confidentialité : journaux de connexion et d'erreurs
 * 12 mois, pages vues du site 13 mois. Lancé chaque jour par le cron.
 */
export async function purgeOldLogs() {
  const logins = await db.delete(loginEvents).where(lt(loginEvents.createdAt, monthsAgo(12))).returning({ id: loginEvents.id });
  const errors = await db.delete(errorLogs).where(lt(errorLogs.lastSeenAt, monthsAgo(12))).returning({ id: errorLogs.id });
  const views = await db.delete(pageViews).where(lt(pageViews.createdAt, monthsAgo(13))).returning({ id: pageViews.id });
  return logins.length + errors.length + views.length;
}

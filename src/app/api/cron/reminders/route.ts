import { timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/server/notifications";

export const dynamic = "force-dynamic";

/** Comparaison en temps constant du secret partagé avec la crontab du VPS. */
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Envoie les rappels de RDV dus. À appeler toutes les 15 minutes depuis le VPS :
 *   *\/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://branshee.com/api/cron/reminders
 */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Non autorisé" }, { status: 401 });
  const result = await sendDueReminders();
  return Response.json(result);
}

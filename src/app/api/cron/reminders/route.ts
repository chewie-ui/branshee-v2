import { cronAuthorized } from "@/server/cron-auth";
import { publishScheduledArticles } from "@/server/jobs";
import { sendDueReminders } from "@/server/notifications";

export const dynamic = "force-dynamic";

/**
 * Toutes les 15 minutes : rappels de RDV dus et articles de blog programmés.
 *   *\/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://branshee.com/api/cron/reminders
 */
export async function POST(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Non autorisé" }, { status: 401 });
  const result = await sendDueReminders();
  const published = await publishScheduledArticles().catch((e) => (console.error("[cron] blog :", e), 0));
  return Response.json({ ...result, articlesPublished: published });
}

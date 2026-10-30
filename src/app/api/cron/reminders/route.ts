import { cronAuthorized } from "@/server/cron-auth";
import { recordError, trackJob } from "@/server/health";
import { publishScheduledArticles, sendAutoReviewRequests } from "@/server/jobs";
import { processCampaignQueue } from "@/server/marketing";
import { expireUnpaidShopOrders } from "@/server/shop";
import { autoStamps } from "@/server/loyalty";
import { cleanupDemos } from "@/server/demo";
import { sendDueReminders } from "@/server/notifications";

export const dynamic = "force-dynamic";

/**
 * Toutes les 15 minutes : rappels de RDV dus et articles de blog programmés.
 *   *\/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://branshee.com/api/cron/reminders
 */
export async function POST(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Non autorisé" }, { status: 401 });
  return Response.json(await trackJob("reminders", async () => {
    const note = (label: string) => async (e: unknown) => {
      console.error(`[cron] ${label} :`, e);
      await recordError({ source: "cron", message: `${label} : ${e instanceof Error ? e.message : String(e)}`, detail: e instanceof Error ? e.stack : null, path: "/api/cron/reminders" });
      return -1;
    };
    const result = await sendDueReminders();
    const published = await publishScheduledArticles().catch(note("blog"));
    const reviewRequests = await sendAutoReviewRequests().catch(note("avis"));
    const campaignEmails = await processCampaignQueue().catch(note("campagnes"));
    const shopExpired = await expireUnpaidShopOrders().catch(note("boutique"));
    const loyaltyStamps = await autoStamps().catch(note("fidélité"));
    const demosCleaned = await cleanupDemos().catch(note("démos"));
    return { ...result, articlesPublished: published, reviewRequests, campaignEmails, shopExpired, loyaltyStamps, demosCleaned };
  }));
}

import { cronAuthorized } from "@/server/cron-auth";
import { reconcileSkydevUsers, sendCreateBusinessNudges, sendSalesFollowUps, sendGrantExpiryReminders, sendOnboardingNudges, sendPlanEndedNotices } from "@/server/jobs";

export const dynamic = "force-dynamic";

/**
 * Une fois par jour (10 h) : relances « Bien démarrer » (J+1, J+3), « créez votre établissement »,
 * fin d'accès offert (J-7, J-1).
 *   0 10 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://branshee.com/api/cron/daily
 */
export async function POST(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Non autorisé" }, { status: 401 });
  const run = async (label: string, fn: () => Promise<number>) => fn().catch((e) => (console.error(`[cron] ${label} :`, e), -1));
  return Response.json({
    onboardingNudges: await run("relances", sendOnboardingNudges),
    createBusinessNudges: await run("créez votre établissement", sendCreateBusinessNudges),
    grantReminders: await run("fin d'accès offert", sendGrantExpiryReminders),
    planEnded: await run("réservation fermée (fin d’essai)", sendPlanEndedNotices),
    skydevUsers: await run("utilisateurs Skydev", reconcileSkydevUsers),
    salesFollowUps: await run("relances Ventes", sendSalesFollowUps),
  });
}

import { cronAuthorized } from "@/server/cron-auth";
import { startTrialsForExisting } from "@/server/jobs";

export const dynamic = "force-dynamic";

/**
 * Passage au modèle « essai 30 jours » (une seule fois, au moment de la bascule) : chaque établissement
 * existant sans abonnement reçoit l'essai complet du forfait Pro, et son propriétaire un email d'explication.
 * Relançable sans effet : un établissement qui a déjà eu un essai ou un forfait n'est plus touché.
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://branshee.com/api/cron/start-trials
 */
export async function POST(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Non autorisé" }, { status: 401 });
  return Response.json(await startTrialsForExisting());
}

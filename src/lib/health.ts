/** Admin › Santé : règles pures (regroupement des erreurs, tâches en retard). Testé. */

/** Même erreur, même ligne : on retire ce qui change d'une fois à l'autre (identifiants, nombres). */
export function normalizeMessage(m: string) {
  return m
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b[0-9a-f]{24,}\b/gi, "<hex>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** Bruit connu, sans action possible (ancien onglet ouvert pendant une mise à jour, robots). */
export function isNoise(m: string) {
  return /Server Reference ID|failed-to-find-server-action|Failed to find Server Action|NEXT_NOT_FOUND|NEXT_REDIRECT|aborted|ECONNRESET|Failed to parse body as FormData|Unexpected end of form|Invalid Server Actions? request|Missing .?next-action|Unexpected token .* in JSON|body (stream )?already|request body too large|Body exceeded/i.test(m);
}

/** Chemin sans identifiants : /app/clients/<id> au lieu d'un chemin par client. */
export const routeOf = (path: string | null | undefined) => (path ? path.split("?")[0]!.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<id>").replace(/\/[A-Za-z0-9_-]{16,}(?=\/|$)/g, "/<jeton>").slice(0, 200) : null);

/** Tâches automatiques et délai au-delà duquel elles sont considérées en panne. */
export const JOBS: Record<string, { label: string; lateAfterMin: number }> = {
  reminders: { label: "Rappels, campagnes, fidélité (toutes les 15 min)", lateAfterMin: 45 },
  daily: { label: "Relances du jour, factures, parrainages (chaque jour à 10 h)", lateAfterMin: 29 * 60 },
};

export function jobLate(name: string, lastRunAt: Date | null, now = new Date()) {
  const j = JOBS[name];
  if (!j) return false;
  if (!lastRunAt) return true;
  return now.getTime() - lastRunAt.getTime() > j.lateAfterMin * 60_000;
}

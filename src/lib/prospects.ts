/**
 * Prospection (app Ventes) : statuts, résultats d'appel, ordre de la file d'appels et statistiques.
 * Pur et testé : aucune base de données ici.
 */

export const PROSPECT_STATUS = {
  todo: { label: "À appeler", tone: "neutral" },
  no_answer: { label: "Pas de réponse", tone: "warning" },
  callback: { label: "À rappeler", tone: "accent" },
  interested: { label: "Intéressé", tone: "success" },
  refused: { label: "Pas intéressé", tone: "danger" },
  invalid: { label: "Mauvais numéro", tone: "neutral" },
  do_not_call: { label: "Ne plus appeler", tone: "neutral" },
} as const;
export type ProspectStatus = keyof typeof PROSPECT_STATUS;
export const isProspectStatus = (s: unknown): s is ProspectStatus => typeof s === "string" && s in PROSPECT_STATUS;

/** Résultat d'un appel → nouveau statut. */
export const OUTCOMES = {
  no_answer: { label: "Pas de réponse", status: "no_answer", answered: false },
  callback: { label: "À rappeler", status: "callback", answered: true },
  interested: { label: "Intéressé", status: "interested", answered: true },
  refused: { label: "Pas intéressé", status: "refused", answered: true },
  invalid: { label: "Mauvais numéro", status: "invalid", answered: false },
  do_not_call: { label: "Ne plus appeler", status: "do_not_call", answered: true },
} as const satisfies Record<string, { label: string; status: ProspectStatus; answered: boolean }>;
export type Outcome = keyof typeof OUTCOMES;
export const isOutcome = (s: unknown): s is Outcome => typeof s === "string" && s in OUTCOMES;

/** Raisons de refus proposées d'un clic (texte libre possible). */
export const REFUSE_REASONS = ["Déjà équipé", "Trop cher", "Pas le moment", "Pas besoin", "Pas le décideur"] as const;

/** Après autant d'appels sans réponse, le prospect sort de la file (« injoignable »). */
export const MAX_ATTEMPTS = 5;
/** Délai avant de rappeler quelqu'un qui n'a pas répondu. */
export const RETRY_AFTER_MS = 3 * 3600_000;

type QueueItem = { id: string; status: string; attempts: number; lastCallAt: Date | null; callbackAt: Date | null; createdAt: Date };

/** Le prospect est-il à appeler maintenant ? */
export function callable(p: QueueItem, now: Date) {
  if (p.status === "todo") return true;
  if (p.status === "callback") return !p.callbackAt || p.callbackAt <= now;
  if (p.status === "no_answer") return p.attempts < MAX_ATTEMPTS && (!p.lastCallAt || now.getTime() - p.lastCallAt.getTime() >= RETRY_AFTER_MS);
  return false;
}

/**
 * Ordre de la file : rappels promis et échus d'abord (le plus ancien en premier), puis les jamais appelés
 * (dans l'ordre d'ajout), puis ceux qui n'ont pas répondu (le moins relancé d'abord).
 */
export function callQueue<T extends QueueItem>(list: T[], now: Date): T[] {
  const rank = (p: T) => (p.status === "callback" ? 0 : p.status === "todo" ? 1 : 2);
  return list
    .filter((p) => callable(p, now))
    .sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r) return r;
      if (a.status === "callback") return (a.callbackAt?.getTime() ?? 0) - (b.callbackAt?.getTime() ?? 0);
      if (a.status === "todo") return a.createdAt.getTime() - b.createdAt.getTime();
      return a.attempts - b.attempts || (a.lastCallAt?.getTime() ?? 0) - (b.lastCallAt?.getTime() ?? 0);
    });
}

/** Statistiques sur une liste d'appels : joints, intéressés, taux, raisons de refus. */
export function callStats(calls: { outcome: string; note?: string | null }[], refusals: (string | null)[] = []) {
  const total = calls.length;
  const answered = calls.filter((c) => isOutcome(c.outcome) && OUTCOMES[c.outcome].answered).length;
  const interested = calls.filter((c) => c.outcome === "interested").length;
  const reasons = new Map<string, number>();
  for (const r of refusals) if (r) reasons.set(r, (reasons.get(r) ?? 0) + 1);
  return {
    total,
    answered,
    interested,
    reachRate: total ? Math.round((answered / total) * 100) : 0,
    interestRate: answered ? Math.round((interested / answered) * 100) : 0,
    reasons: [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}

/** Numéro comparable (doublons) : chiffres seuls, 0032… / +32… → 0… */
export function phoneKey(phone: string | null | undefined) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0032")) return `0${d.slice(4)}`;
  if (d.startsWith("32") && d.length >= 10) return `0${d.slice(2)}`;
  return d;
}

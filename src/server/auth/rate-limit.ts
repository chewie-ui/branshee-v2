import "server-only";

/**
 * Limiteur en mémoire (fenêtre glissante). Suffisant pour un seul serveur (VPS) ;
 * à remplacer par Redis/Postgres si l'app tourne un jour sur plusieurs instances.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - recent[0]!)) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return { ok: true, retryAfterSec: 0 };
}

/** Remet un compteur à zéro (ex. connexion réussie : seuls les échecs doivent compter). */
export function resetRateLimit(key: string) {
  hits.delete(key);
}

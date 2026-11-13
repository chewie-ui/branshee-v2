import "server-only";
import type { SiteSection } from "@/lib/site-templates";

/**
 * Brouillon de « Mon site » pour l'aperçu en direct de l'éditeur (pas encore enregistré).
 * Gardé en mémoire 30 min par établissement : rien n'est écrit dans le site tant qu'on n'a pas cliqué « Enregistrer ».
 */
export type SiteDraft = { sections: SiteSection[]; theme: Record<string, unknown>; logoUrl: string | null; social: Record<string, string> };

const TTL = 30 * 60 * 1000;
const g = globalThis as unknown as { __siteDrafts?: Map<string, { draft: SiteDraft; at: number }> };
const store = (g.__siteDrafts ??= new Map());

export function putSiteDraft(businessId: string, draft: SiteDraft) {
  const now = Date.now();
  for (const [k, v] of store) if (now - v.at > TTL) store.delete(k);
  store.set(businessId, { draft, at: now });
}

export function getSiteDraft(businessId: string): SiteDraft | null {
  const v = store.get(businessId);
  return v && Date.now() - v.at <= TTL ? v.draft : null;
}

export function clearSiteDraft(businessId: string) {
  store.delete(businessId);
}

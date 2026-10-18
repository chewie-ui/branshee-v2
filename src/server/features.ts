import "server-only";
import { db } from "@/db";
import { featureFlags } from "@/db/schema";
import type { FeatureStatus } from "@/lib/features";

type Flag = { status: FeatureStatus; message: string | null; hiddenInNav: boolean };
let cache: { at: number; map: Map<string, Flag> } | null = null;

/** Interrupteurs du super-admin, gardés 15 s en mémoire (évite une requête par page vue). */
export async function getFlags() {
  if (cache && Date.now() - cache.at < 15000) return cache.map;
  try {
    const rows = await db.select().from(featureFlags);
    cache = { at: Date.now(), map: new Map(rows.map((r) => [r.key, { status: r.status, message: r.message, hiddenInNav: r.hiddenInNav }])) };
  } catch {
    cache = { at: Date.now(), map: new Map() };
  }
  return cache.map;
}

export function invalidateFlags() {
  cache = null;
}

/** Statut d'une page ou fonctionnalité (« active » par défaut). */
export async function featureStatus(key: string): Promise<{ status: FeatureStatus; message: string | null }> {
  const f = (await getFlags()).get(key);
  return { status: f?.status ?? "active", message: f?.message ?? null };
}

export async function featureOn(key: string) {
  return (await featureStatus(key)).status === "active";
}

/** Interrupteur caché : éteint tant qu'il n'a pas été allumé explicitement. */
export async function hiddenFeatureOn(key: string) {
  return (await getFlags()).get(key)?.status === "active";
}

export async function hiddenNavHrefs() {
  const out = new Set<string>();
  for (const [k, f] of await getFlags()) if (k.startsWith("nav:") && f.hiddenInNav) out.add(k.slice(4));
  return out;
}

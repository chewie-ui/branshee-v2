import "server-only";
import { lookup } from "node:dns";
import { request } from "node:https";
import { after } from "next/server";
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, businesses, users, webhookDeliveries, webhooks } from "@/db/schema";
import { decrypt } from "@/lib/field-crypto";
import { hashKey, isPrivateIp, looksLikeKey, signPayload, type Scope, type WebhookEvent } from "@/lib/connect";
import { rateLimit } from "@/server/auth/rate-limit";
import { isLocked } from "@/server/plan";

export type KeyAuth = { keyId: string; businessId: string; slug: string; name: string; scopes: string[]; locked: boolean };
export class ConnectError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

/**
 * Authentifie une requête de l'API des sites connectés : « Authorization: Bearer sk_live_… ».
 * La clé est secrète : une requête faite depuis un navigateur (CORS) est refusée, pour qu'elle ne
 * finisse jamais dans le code visible d'une page.
 */
export async function authenticate(req: Request, scope: Scope): Promise<KeyAuth> {
  if (req.headers.get("origin") && req.headers.get("sec-fetch-mode") === "cors") throw new ConnectError(403, "server_only", "La clé secrète s'utilise uniquement côté serveur (jamais dans le navigateur). Pour une page publique, utilisez les widgets à copier-coller.");
  const raw = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!looksLikeKey(raw)) throw new ConnectError(401, "unauthorized", "Clé API manquante ou invalide (en-tête Authorization: Bearer sk_live_…).");
  const [k] = await db
    .select({ id: apiKeys.id, businessId: apiKeys.businessId, scopes: apiKeys.scopes, lastUsedAt: apiKeys.lastUsedAt, slug: businesses.slug, name: businesses.name, brand: businesses.brand })
    .from(apiKeys)
    .innerJoin(businesses, eq(businesses.id, apiKeys.businessId))
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .where(and(eq(apiKeys.keyHash, hashKey(raw)), isNull(apiKeys.revokedAt), isNull(businesses.deletedAt), isNull(users.disabledAt), eq(businesses.isDemo, false)));
  if (!k) throw new ConnectError(401, "unauthorized", "Clé API inconnue ou révoquée.");
  if (!rateLimit(`connect:${k.id}`, 120, 60_000).ok) throw new ConnectError(429, "rate_limited", "Trop de requêtes : 120 par minute maximum par clé.");
  if (!k.scopes.includes(scope)) throw new ConnectError(403, "forbidden_scope", `Cette clé n'a pas le droit « ${scope} ». Créez une clé avec ce droit dans Skydev › Réglages › Connecter un site.`);
  if (!k.lastUsedAt || Date.now() - k.lastUsedAt.getTime() > 60_000) await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, k.id));
  return { keyId: k.id, businessId: k.businessId, slug: k.slug, name: k.name, scopes: k.scopes, locked: await isLocked(k.businessId, k.brand) };
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

const BACKOFF_MIN = [1, 5, 30, 120, 720];
const MAX_ATTEMPTS = BACKOFF_MIN.length + 1;

/** Enregistre l'événement pour chaque webhook abonné et tente l'envoi tout de suite (après la réponse). */
export async function emitWebhook(businessId: string, event: WebhookEvent, data: Record<string, unknown>) {
  try {
    const hooks = await db.select({ id: webhooks.id }).from(webhooks).where(and(eq(webhooks.businessId, businessId), isNull(webhooks.disabledAt), sql`${event} = any(${webhooks.events})`));
    if (!hooks.length) return;
    const created = await db
      .insert(webhookDeliveries)
      .values(hooks.map((h) => ({ webhookId: h.id, businessId, event, payload: { event, createdAt: new Date().toISOString(), data } })))
      .returning({ id: webhookDeliveries.id });
    const run = () => Promise.all(created.map((d) => deliver(d.id)));
    try { after(run); } catch { void run(); }
  } catch (e) {
    console.error("[webhooks] émission :", e);
  }
}

/** POST https vers une adresse publique uniquement (l'adresse IP est vérifiée au moment même de la connexion). */
function postSafely(url: string, body: string, headers: Record<string, string>): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = request(
      {
        protocol: "https:",
        hostname: u.hostname,
        port: 443,
        path: `${u.pathname}${u.search}`,
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "User-Agent": "Skydev-Webhooks/1.0" },
        timeout: 8000,
        lookup: (host, opts, cb) =>
          lookup(host, { all: true }, (err, addrs) => {
            if (err) return cb(err, "", 0);
            const list = (addrs as { address: string; family: number }[]).filter((a) => !isPrivateIp(a.address));
            if (!list.length || list.length !== (addrs as unknown[]).length) return cb(new Error("Adresse interne refusée"), "", 0);
            const pick = list[0]!;
            if ((opts as { all?: boolean }).all) return (cb as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [pick]);
            cb(null, pick.address, pick.family);
          }),
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("Délai dépassé (8 s)")));
    req.on("error", reject);
    req.end(body);
  });
}

/** Un envoi : signé, une tentative ; en cas d'échec, nouvelle tentative plus tard (1 min, 5 min, 30 min, 2 h, 12 h). */
export async function deliver(deliveryId: string) {
  const [d] = await db.select({ d: webhookDeliveries, url: webhooks.url, secret: webhooks.secret, disabled: webhooks.disabledAt }).from(webhookDeliveries).innerJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId)).where(eq(webhookDeliveries.id, deliveryId));
  if (!d || d.d.status !== "pending" || d.disabled) return false;
  const body = JSON.stringify({ id: d.d.id, ...(d.d.payload as object) });
  const secret = decrypt(d.secret) ?? "";
  const sig = signPayload(secret, body);
  let status = 0;
  let error: string | null = null;
  try {
    status = (await postSafely(d.url, body, { "Skydev-Signature": sig.header, "Skydev-Event": d.d.event, "Skydev-Delivery": d.d.id })).status;
    if (status < 200 || status >= 300) error = `Réponse HTTP ${status}`;
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 200) : "Échec de l'envoi";
  }
  const attempts = d.d.attempts + 1;
  const ok = !error;
  await db
    .update(webhookDeliveries)
    .set({ attempts, status: ok ? "sent" : attempts >= MAX_ATTEMPTS ? "failed" : "pending", lastError: error, nextAttemptAt: new Date(Date.now() + (BACKOFF_MIN[attempts - 1] ?? 720) * 60_000) })
    .where(eq(webhookDeliveries.id, d.d.id));
  await db.update(webhooks).set({ lastStatus: status || null, lastError: error, lastAt: new Date() }).where(eq(webhooks.id, d.d.webhookId));
  return ok;
}

/** Tâche planifiée : nouvelles tentatives des envois échoués dont l'heure est venue. */
export async function retryWebhooks(limit = 50) {
  const due = await db.select({ id: webhookDeliveries.id }).from(webhookDeliveries).where(and(eq(webhookDeliveries.status, "pending"), lte(webhookDeliveries.nextAttemptAt, new Date()), sql`(${webhookDeliveries.attempts} > 0 or ${webhookDeliveries.createdAt} < now() - interval '2 minutes')`)).orderBy(webhookDeliveries.nextAttemptAt).limit(limit);
  let sent = 0;
  for (const d of due) if (await deliver(d.id)) sent++;
  // Ménage : on garde 30 jours d'historique.
  await db.delete(webhookDeliveries).where(sql`${webhookDeliveries.createdAt} < now() - interval '30 days'`);
  return { retried: due.length, sent };
}

export async function deliveriesOf(businessId: string, hookIds: string[]) {
  if (!hookIds.length) return [];
  return db.select().from(webhookDeliveries).where(and(eq(webhookDeliveries.businessId, businessId), inArray(webhookDeliveries.webhookId, hookIds))).orderBy(sql`${webhookDeliveries.createdAt} desc`).limit(30);
}

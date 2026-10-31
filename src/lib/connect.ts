/**
 * Sites connectés (pur, testé) : droits des clés API, format des clés, signature des webhooks,
 * adresses de webhook acceptées (pas de réseau interne : protection contre les requêtes détournées).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export { SCOPES, EVENTS, isScope, isEvent, type Scope, type WebhookEvent } from "./connect-meta";

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function base62(bytes: Buffer) {
  let out = "";
  for (const b of bytes) out += B62[b % 62];
  return out;
}

/** Nouvelle clé secrète : « sk_live_ » + 40 caractères aléatoires. */
export function newApiKey() {
  const key = `sk_live_${base62(randomBytes(40))}`;
  return { key, prefix: key.slice(0, 12), hash: hashKey(key) };
}
export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
export const looksLikeKey = (s: string) => /^sk_live_[0-9A-Za-z]{40}$/.test(s);

export const newWebhookSecret = () => `whsec_${base62(randomBytes(32))}`;

/** En-tête « Skydev-Signature: t=…,v1=… » : HMAC-SHA256 de « t.corps » avec le secret du webhook. */
export function signPayload(secret: string, body: string, t = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return { header: `t=${t},v1=${v1}`, t, v1 };
}

/** Vérification (même code que dans la documentation pour les développeurs). Tolérance : 5 minutes. */
export function verifySignature(secret: string, body: string, header: string, now = Math.floor(Date.now() / 1000), tolerance = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1 || Math.abs(now - t) > tolerance) return false;
  const expected = Buffer.from(signPayload(secret, body, t).v1, "hex");
  const got = Buffer.from(parts.v1, "hex");
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Adresse IP privée, locale ou réservée (IPv4 et IPv6) : jamais appelée par un webhook. */
export function isPrivateIp(ip: string) {
  const v = ip.toLowerCase().replace(/^::ffff:/, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) {
    const [a, b] = v.split(".").map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("ff");
}

/** Adresse de webhook acceptée : https, nom de domaine public (pas d'IP, pas de localhost, pas de port exotique). */
export function webhookUrlProblem(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return "Adresse invalide."; }
  if (u.protocol !== "https:") return "L'adresse doit commencer par https://";
  if (u.username || u.password) return "L'adresse ne doit pas contenir d'identifiants.";
  if (u.port && u.port !== "443") return "Seul le port 443 (https standard) est accepté.";
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost") || host === "localhost") return "Indiquez l'adresse publique de votre site.";
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[")) return "Indiquez un nom de domaine, pas une adresse IP.";
  if (raw.length > 500) return "Adresse trop longue.";
  return null;
}

import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Protection anti-robots des formulaires publics (inscription…), invisible pour les vrais visiteurs :
 * - jeton signé posé par la page (heure d'affichage) : un robot qui poste directement n'en a pas, et un humain
 *   met au moins quelques secondes à remplir le formulaire ;
 * - champ piège caché (« website ») : seuls les robots le remplissent ;
 * - nom au hasard (« Pxktwyytc », « Mcrtg ») : un seul mot avec 4 consonnes d'affilée.
 */
const key = () => createHash("sha256").update(`form:${process.env.DATA_ENCRYPTION_KEY ?? "dev"}`).digest();
const MIN_MS = 3_000;
const MAX_MS = 12 * 60 * 60 * 1000;

/** Jeton à mettre dans le formulaire au moment où la page est affichée. */
export function formToken(scope: string): string {
  const t = Date.now().toString(36);
  const sig = createHmac("sha256", key()).update(`${scope}.${t}`).digest("base64url").slice(0, 22);
  return `${t}.${sig}`;
}

function tokenOk(scope: string, token: string): "ok" | "fast" | "bad" {
  const [t, sig] = token.split(".");
  if (!t || !sig) return "bad";
  const expected = createHmac("sha256", key()).update(`${scope}.${t}`).digest("base64url").slice(0, 22);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "bad";
  const age = Date.now() - parseInt(t, 36);
  if (!Number.isFinite(age) || age > MAX_MS || age < 0) return "bad";
  return age < MIN_MS ? "fast" : "ok";
}

/** Nom tapé au hasard par un robot : un seul mot, 4 consonnes ou plus d'affilée (les vrais noms ont presque toujours un prénom et un nom). */
export function looksRandomName(name: string): boolean {
  const n = name.trim();
  if (/\s/.test(n) || n.length < 4) return false;
  return /[bcdfghjklmnpqrstvwxz]{4,}/i.test(n.normalize("NFD").replace(/[̀-ͯ]/g, ""));
}

export type BotVerdict = { bot: false } | { bot: true; reason: string };

export function checkBot(scope: string, fd: FormData, opts: { name?: string } = {}): BotVerdict {
  if (String(fd.get("website") ?? "").trim()) return { bot: true, reason: "piège" };
  const v = tokenOk(scope, String(fd.get("ft") ?? ""));
  if (v !== "ok") return { bot: true, reason: v === "fast" ? "trop rapide" : "jeton" };
  if (opts.name && looksRandomName(opts.name)) return { bot: true, reason: "nom au hasard" };
  return { bot: false };
}

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

// Paramètres scrypt recommandés (OWASP) : N=2^17, r=8, p=1.
const PARAMS = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const KEYLEN = 64;

/** Format stocké : scrypt$N$r$p$sel$hash (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

/** Hash hérité de l'ancien Branshee (bcrypt) : à remplacer par un hash scrypt à la prochaine connexion. */
export const isLegacyHash = (stored: string | null | undefined) => !!stored && /^\$2[aby]\$/.test(stored);

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  if (isLegacyHash(stored)) return bcrypt.compare(password, stored);
  const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Hash factice utilisé quand l'email n'existe pas : le temps de réponse reste le même (pas d'énumération). */
let dummy: string | null = null;
export async function burnPasswordCheck(password: string) {
  dummy ??= await hashPassword("branshee-timing-equalizer");
  await verifyPassword(password, dummy);
}

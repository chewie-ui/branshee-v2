import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/**
 * Chiffrement des données sensibles en base (dossiers clients, jetons Google…).
 * AES-256-GCM, clé de 32 octets en hexadécimal dans DATA_ENCRYPTION_KEY (openssl rand -hex 32).
 * Format stocké : v1.<iv base64url>.<tag base64url>.<données base64url>
 */
function key(): Buffer {
  const hex = process.env.DATA_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) throw new Error("DATA_ENCRYPTION_KEY manquante ou invalide (64 caractères hexadécimaux attendus).");
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/**
 * Clés de lecture : la clé actuelle, puis l'ancienne (DATA_ENCRYPTION_KEY_PREVIOUS) pour les données chiffrées
 * avant une fusion de bases (Branshee → Skydev). On écrit toujours avec la clé actuelle.
 */
export function readKeys(): Buffer[] {
  const prev = process.env.DATA_ENCRYPTION_KEY_PREVIOUS;
  return [key(), ...(prev && /^[0-9a-f]{64}$/i.test(prev) ? [Buffer.from(prev, "hex")] : [])];
}

export function decrypt(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || data === undefined) throw new Error("Format chiffré inconnu.");
  let lastError: unknown;
  for (const k of readKeys()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

/**
 * Empreinte déterministe (HMAC-SHA256, clé dérivée de DATA_ENCRYPTION_KEY) d'une valeur sensible :
 * permet l'unicité et la recherche exacte (ex. NISS) sans stocker la valeur en clair.
 */
export function blindIndex(value: string, purpose: string): string {
  return createHmac("sha256", key()).update(`${purpose}:${value}`).digest("base64url");
}

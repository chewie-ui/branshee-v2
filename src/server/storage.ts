import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";

/**
 * Stockage des fichiers sur le disque du serveur (dossier STORAGE_DIR, « ./storage » par défaut).
 *
 *   private/         pièces jointes des dossiers clients — CHIFFRÉES (AES-256-GCM, même clé que la base)
 *   public/          images publiques (logo, galerie, photos) servies sur /media/…
 *   legacy-private/  copie de `private_uploads/` de l'ancien Branshee (PDF des dossiers, non chiffrés)
 *   legacy-public/   copie de `public/uploads/` de l'ancien Branshee, servie sur /uploads/… comme avant
 */
const root = () => resolve(process.env.STORAGE_DIR ?? "storage");

/** Empêche toute sortie du dossier prévu (« ../../etc/passwd »). */
function inside(base: string, rel: string) {
  const full = resolve(base, normalize(rel).replace(/^([/\\])+/, ""));
  if (full !== base && !full.startsWith(base + sep)) throw new Error("Chemin de fichier invalide.");
  return full;
}

function key(): Buffer {
  const hex = process.env.DATA_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) throw new Error("DATA_ENCRYPTION_KEY manquante ou invalide.");
  return Buffer.from(hex, "hex");
}

const MAGIC = Buffer.from("BSE1");

function encryptBuffer(data: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

function decryptBuffer(blob: Buffer) {
  if (!blob.subarray(0, 4).equals(MAGIC)) throw new Error("Fichier chiffré illisible.");
  const decipher = createDecipheriv("aes-256-gcm", key(), blob.subarray(4, 16));
  decipher.setAuthTag(blob.subarray(16, 32));
  return Buffer.concat([decipher.update(blob.subarray(32)), decipher.final()]);
}

/** Enregistre un fichier privé chiffré ; renvoie sa référence à stocker en base (« v2/<uuid> »). */
export async function savePrivateFile(data: Buffer) {
  const id = randomUUID();
  const dir = join(root(), "private");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.bin`), encryptBuffer(data));
  return `v2/${id}`;
}

/** Lit un fichier privé : les nouveaux sont déchiffrés, ceux de l'ancien Branshee lus tels quels. */
export async function readPrivateFile(ref: string) {
  if (ref.startsWith("v2/")) {
    const id = ref.slice(3);
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Référence invalide.");
    return decryptBuffer(await readFile(join(root(), "private", `${id}.bin`)));
  }
  return readFile(inside(join(root(), "legacy-private"), ref));
}

export async function deletePrivateFile(ref: string | null | undefined) {
  if (!ref?.startsWith("v2/")) return; // les fichiers de l'ancien Branshee ne sont jamais supprimés automatiquement
  const id = ref.slice(3);
  if (/^[0-9a-f-]{36}$/.test(id)) await rm(join(root(), "private", `${id}.bin`), { force: true });
}

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/** Vérifie la signature réelle du fichier (et pas seulement son extension). */
export function sniffImage(data: Buffer): string | null {
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (data.subarray(0, 4).toString("ascii") === "GIF8") return "image/gif";
  return null;
}

export const isPdf = (data: Buffer) => data.subarray(0, 5).toString("ascii") === "%PDF-";

/** Enregistre une image publique ; renvoie son URL (« /media/<uuid>.jpg »). */
export async function savePublicImage(data: Buffer) {
  const type = sniffImage(data);
  if (!type) throw new Error("Format d'image non pris en charge (JPG, PNG, WebP ou GIF).");
  const name = `${randomUUID()}.${IMAGE_TYPES[type]}`;
  const dir = join(root(), "public");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), data);
  return `/media/${name}`;
}

export async function deletePublicImage(url: string | null | undefined) {
  const m = url?.match(/^\/media\/([0-9a-f-]{36}\.(?:jpg|png|webp|gif))$/);
  if (m) await rm(join(root(), "public", m[1]!), { force: true });
}

/** Lecture pour les routes /media et /uploads. Renvoie null si le fichier n'existe pas. */
export async function readPublic(kind: "media" | "legacy", rel: string): Promise<{ data: Buffer; type: string } | null> {
  try {
    const base = join(root(), kind === "media" ? "public" : "legacy-public");
    const data = await readFile(inside(base, rel));
    const ext = rel.split(".").pop()?.toLowerCase() ?? "";
    const type = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", pdf: "application/pdf" }[ext] ?? "application/octet-stream";
    return { data, type };
  } catch {
    return null;
  }
}

import "server-only";
import { createHash } from "node:crypto";
import { clientIp } from "@/lib/client-ip";

/**
 * Empreinte du jour d'un visiteur (IP + navigateur + date + secret), non réversible et sans cookie :
 * compte les visiteurs uniques et retrouve la source d'une inscription, sans rien déposer sur l'appareil.
 */
export function visitorId(h: Headers, day = new Date().toISOString().slice(0, 10)) {
  return createHash("sha256").update(`${clientIp(h) ?? ""}|${h.get("user-agent") ?? ""}|${day}|${process.env.DATA_ENCRYPTION_KEY ?? "dev"}`).digest("hex").slice(0, 32);
}

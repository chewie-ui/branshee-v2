import { headers } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, documents } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";
import { rateLimit } from "@/server/auth/rate-limit";
import { fileResponse } from "@/server/document-response";

/** Lien de partage d'un document : téléchargement sans compte, tant que le lien est valable. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const text = (s: string, status: number) => new Response(s, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (!/^[\w-]{20,40}$/.test(token)) return text("Lien introuvable.", 404);
  if (!rateLimit(`share:${clientIp(await headers()) ?? "?"}`, 60, 3600_000).ok) return text("Trop de téléchargements. Réessayez plus tard.", 429);
  const [d] = await db
    .select({ fileRef: documents.fileRef, name: documents.name, mime: documents.mime })
    .from(documents)
    .innerJoin(businesses, eq(businesses.id, documents.businessId))
    .where(and(eq(documents.shareToken, token), gt(documents.shareExpiresAt, new Date()), isNull(businesses.deletedAt)));
  if (!d) return text("Ce lien de partage a expiré ou a été désactivé.", 404);
  return fileResponse(d, true);
}

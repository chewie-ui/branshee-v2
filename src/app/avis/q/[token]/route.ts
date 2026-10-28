import { headers } from "next/headers";
import { db } from "@/db";
import { reviewRequests } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";
import { rateLimit } from "@/server/auth/rate-limit";
import { newReviewToken, settingsByQr } from "@/server/google-reviews";

/** Scan du QR code du comptoir : une demande « qr » est créée puis la page d'avis s'ouvre. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const s = await settingsByQr((await params).token);
  if (!s) return new Response("Ce QR code n'est plus valable.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const ip = clientIp(await headers()) ?? "inconnue";
  if (!rateLimit(`review-qr:${ip}`, 10, 3600_000).ok) return new Response("Trop de scans. Réessayez plus tard.", { status: 429, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const token = newReviewToken();
  await db.insert(reviewRequests).values({ businessId: s.businessId, channel: "qr", token, openedAt: new Date() });
  return new Response(null, { status: 302, headers: { Location: new URL(`/avis/${token}`, req.url).pathname, "Cache-Control": "no-store" } });
}

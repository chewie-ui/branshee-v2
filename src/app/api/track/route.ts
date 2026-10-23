import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { pageViews } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";

export const dynamic = "force-dynamic";

const schema = z.object({
  path: z.string().max(300).startsWith("/"),
  source: z.string().max(100).optional(),
  medium: z.string().max(100).optional(),
  campaign: z.string().max(150).optional(),
  term: z.string().max(150).optional(),
  content: z.string().max(150).optional(),
  gclid: z.string().max(200).optional(),
  referrer: z.string().max(500).optional(),
});

const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|bingpreview/i;
const ACQ_COOKIE = "bs_acq";

/** Enregistre une vue de page publique ; garde la première source connue (30 jours) pour l'inscription. */
export async function POST(req: Request) {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  if (BOTS.test(ua)) return new Response(null, { status: 204 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 204 });
  const d = parsed.data;
  if (/^\/(app|admin|api|espace-client)(\/|$)/.test(d.path)) return new Response(null, { status: 204 });
  let refHost: string | null = null;
  try {
    refHost = d.referrer ? new URL(d.referrer).hostname.replace(/^www\./, "") : null;
  } catch {
    refHost = null;
  }
  const source = d.source || refHost || null;
  const medium = d.medium || (d.gclid ? "cpc" : refHost ? "referral" : null);
  const ip = (clientIp(h) ?? "");
  // Empreinte du jour (IP + navigateur + date + secret) : compte les visiteurs uniques sans cookie ni donnée réversible.
  const day = new Date().toISOString().slice(0, 10);
  const visitorId = createHash("sha256").update(`${ip}|${ua}|${day}|${process.env.DATA_ENCRYPTION_KEY ?? "dev"}`).digest("hex").slice(0, 32);
  await db.insert(pageViews).values({ visitorId, path: d.path.slice(0, 300), source, medium, campaign: d.campaign || null, gclid: d.gclid || null }).catch(() => {});
  // Attribution de l'inscription : première source vue, gardée 30 jours (cookie fonctionnel, première partie).
  const jar = await cookies();
  if (!jar.has(ACQ_COOKIE) && (source || d.campaign || d.gclid)) {
    const acq = { source: source ?? undefined, medium: medium ?? undefined, campaign: d.campaign, term: d.term, content: d.content, gclid: d.gclid, referrer: d.referrer, landing: d.path, capturedAt: new Date().toISOString() };
    jar.set(ACQ_COOKIE, Buffer.from(JSON.stringify(acq)).toString("base64url"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 });
  }
  return new Response(null, { status: 204 });
}

import { headers } from "next/headers";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { pageViews } from "@/db/schema";
import { visitorId } from "@/server/visitor";

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
  // Empreinte du jour (voir server/visitor) : compte les visiteurs uniques sans cookie ni donnée réversible.
  const vid = visitorId(h);
  await db.insert(pageViews).values({ visitorId: vid, path: d.path.slice(0, 300), source, medium, campaign: d.campaign || null, gclid: d.gclid || null }).catch(() => {});
  // Attribution d'une inscription : retrouvée au moment de l'inscription grâce à l'empreinte du jour (aucun cookie).

  return new Response(null, { status: 204 });
}

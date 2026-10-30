import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { clientIp } from "@/lib/client-ip";
import { rateLimit } from "@/server/auth/rate-limit";
import { BUSINESS_COOKIE, createSession, getSessionUser } from "@/server/auth/session";
import { currentBrand } from "@/server/brand";
import { createDemoSandbox } from "@/server/demo";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";

const origin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");

/**
 * « Voir la démo » : chaque visiteur reçoit sa propre copie d'un cabinet fictif, sans inscription.
 * Déjà dans une démo : on y retourne. Connecté avec un vrai compte : on ne touche pas à sa session.
 */
export async function GET(req: NextRequest) {
  if ((await currentBrand()).id !== "skydev") return NextResponse.redirect(`${origin()}/`);
  const me = await getSessionUser();
  if (me && !me.user.isDemo) return NextResponse.redirect(`${origin()}/app`);
  const h = await headers();
  if (!me?.user.isDemo && !rateLimit(`demo:${clientIp(h) ?? "?"}`, 20, 3600_000).ok) return NextResponse.redirect(`${origin()}/?demo=plus-tard`);
  const [mine] = me ? await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.ownerId, me.user.id), eq(businesses.isDemo, true))).limit(1) : [];
  let businessId = mine?.id;
  if (!businessId) {
    const sandbox = await createDemoSandbox();
    businessId = sandbox.businessId;
    await createSession(sandbox.userId, { userAgent: h.get("user-agent"), ip: clientIp(h) });
  }
  const res = NextResponse.redirect(`${origin()}${req.nextUrl.searchParams.get("app") === "rdv" ? "/app/agenda" : "/app"}`);
  res.cookies.set(BUSINESS_COOKIE, businessId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 86400 });
  return res;
}
